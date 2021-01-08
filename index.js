const discord = require("discord.js");
const config = require("./config.json");
const Client = new discord.Client();
const prefix = config.prefix;
const sqlite = require('sqlite3').verbose();
const db = new sqlite.Database('db.sqlite', (err) => {
    if (err) throw err;
})
const utils = require("./music");

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id VARCHAR(25) NOT NULL, pvc VARCHAR(25))");
    db.run(`CREATE TABLE IF NOT EXISTS addrequests (id VARCHAR(25) NOT NULL, accepted BOOLEAN, recipient VARCHAR (25) NOT NULL, sender VARCHAR(25) NOT NULL, msg VARCHAR(25) NOT NULL)`)
})

Client.on("ready", () => {
    console.log("Bot is ready");
});

Client.on("message", msg => {
    if (msg.author.bot) return;

    const messageArray = msg.content.split(/ /g);
    const args = messageArray.slice(1);
    const cmd = messageArray[0].slice(prefix.length);

    db.get(`SELECT * FROM users WHERE id = '${msg.author.id}'`, (err, rows) => {
        if (err) throw err;
        if (!rows) {
            db.run(`INSERT INTO users (id) VALUES ('${msg.author.id}')`);
        }
    })

    switch (cmd) {
        case 'ping':
            msg.channel.send("pong bitc!");
            break;
        case 'play':
            play(msg, args.join(" "));
            break;
        case 'setVolume':
            if (!queue[msg.guild.id])
                break;
        case 'disconnect':
            if (queue[msg.guild.id].dispatcher) {
                queue[msg.guild.id].dispatcher.destroy();
                queue[msg.guild.id].dispatcher = null;
                queue[msg.guild.id].queue = [];
            }
            msg.guild.voice?.connection?.disconnect();
            break;
        case 'pvc':
            msg.delete();
            db.get(`SELECT * FROM users WHERE id = '${msg.author.id}'`, (err, rows) => {
                if (err) throw err;

                if (rows.pvc) return msg.author.send("You already have a private voice channel");

                const category = msg.guild.channels.resolve(config.privatevc_cagegory);

                msg.guild.channels.create(`${msg.author.username.toLowerCase()}`, {
                    parent: category.id,
                    type: 'voice',
                    permissionOverwrites: [{
                            id: msg.author.id,
                            allow: [
                                "CONNECT",
                                "SPEAK",
                                "STREAM",
                                "VIEW_CHANNEL"
                            ],
                        },
                        {
                            id: msg.guild.roles.everyone.id,
                            deny: [
                                "CONNECT",
                                "SPEAK",
                                "STREAM",
                                "VIEW_CHANNEL"
                            ]
                        }
                    ]
                }).then(ch => {
                    msg.delete();
                    msg.author.send("Created your private voice channel");

                    db.run(`UPDATE users SET pvc = '${ch.id}' WHERE id = '${msg.author.id}'`)
                }).catch(console.error);
            });

            msg.delete();
            break;
        case 'deletepvc':
            db.get(`SELECT * FROM users WHERE id = '${msg.author.id}'`, (err, rows) => {
                if (err) throw err;

                if (!rows.pvc) {
                    return msg.author.send("You don't have a private voice channel")
                }
                
                const ch = msg.guild.channels.resolve(rows.pvc);
                ch.delete();
                msg.author.send("Deleted your private voice channel");
                db.run(`UPDATE users SET pvc = null WHERE id = '${msg.author.id}'`)
            })
            msg.delete();
            break;
        case 'pvcadd':
            if (!msg.mentions.members.first()) {
                return msg.author.send("You didn't mention anyone to add");
            }
            db.get(`SELECT * FROM users WHERE id = '${msg.author.id}'`, (err, user) => {
                if (err) throw err;

                if (!user.pvc) {
                    return msg.author.send("You don't have a private vc")
                }

                const usertoadd = msg.mentions.users.first();

                db.get(`SELECT * FROM addrequests WHERE sender = '${msg.author.id}' AND recipient = '${usertoadd.id}' AND accepted IS NULL`, (err, addrequest) => {
                    if (err) throw err;

                    if (addrequest) {
                        return msg.author.send("You already sent this user a request");
                    }
                    
                    usertoadd.send(
                        `${msg.author} would like to add you to their private voice channel. Do you accept?`
                    ).then(async m => {
                        db.run(`INSERT INTO addrequests (id, accepted, recipient, sender, msg) VALUES ('${user.pvc}', null, '${usertoadd.id}', '${msg.author.id}', '${m.id}')`)
                        await m.react("✅");
                        await m.react("❌");
                    });

                    msg.author.send("Sent a request to add them");
                });

                
            })

            msg.delete();
            break;
    }
});

Client.on("messageReactionAdd", (reaction, user) => {
    // SELECT * FROM addrequests WHERE message is a add request message AND recipient is the reactor
    db.get(`SELECT * FROM addrequests WHERE msg = '${reaction.message.id}' AND recipient = '${user.id}'`, (err, rows) => {
        if (err) throw err;

        if (!rows) return;

        if (reaction.emoji.name == "✅") {
            Client.channels.fetch(rows.id).then(ch => {
                ch.createOverwrite(user.id, {
                    CONNECT: true,
                    SPEAK: true,
                    STREAM: true,
                    VIEW_CHANNEL: true
                }).then(() => {
                    reaction.message.edit("Added you to the channel.");
                    db.run(`UPDATE addrequests SET accepted = TRUE WHERE msg = '${user.id}'`);
                }).catch(console.error);
            })
        } else if (reaction.emoji.name == "❌") {
            reaction.message.edit("You have denied your add request");
            db.run(`UPDATE addrequests SET accepted = FALSE WHERE msg = '${user.id}'`);
        }
    })
})

Client.login()