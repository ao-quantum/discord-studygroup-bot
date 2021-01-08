const queue = {};
const queuePrototype = {
    volume: 0.5,
    queue: [],
    dispatcher: null
};

function play(msg, url) {
    msg.member.voice.channel.join().then(async vc => {
        if (!queue[msg.guild.id].dispatcher) {
            const dispatcher = vc.play(await ytdl(url), {type: 'opus'});
            dispatcher.on("start", () => {
                msg.channel.send(`Playing ${url}`);
            });
            dispatcher.on("finish", () => {
                queue[msg.guild.id].queue.shift();
                if (queue[msg.guild.id].queue.length > 0) {
                    play(msg, queue[msg.guild.id].queue[0]);
                } else {
                    disconnect(msg.guild);
                }
            });

            queue[msg.guild.id].dispatcher = dispatcher;
            queue[msg.guild.id].queue.push(url);
        } else {
            if (queue[msg.guild.id].queue.length > 0) {
                return queue[msg.guild.id].queue.push(url);
            }
            
        }
        
    });
}

function setVolume(newVolume, guild) {
    
}

function disconnect(guild) {
    queue[msg.guild.id].dispatcher.destroy();
    queue[msg.guild.id].dispatcher = null;
    queue[msg.guild.id].queue = [];
    guild.voice?.connection?.disconnect();
}
