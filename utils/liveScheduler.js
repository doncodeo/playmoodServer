const LiveProgram = require('../models/liveProgramModel');
const { getWss, sendToUser } = require('../websocket');
const WebSocket = require('ws');

let schedulerInterval;

const checkSchedule = async () => {
    try {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);

        // Find programs for today that are either scheduled or live
        const programs = await LiveProgram.find({
            date: today,
            status: { $in: ['scheduled', 'live'] },
        });

        for (const program of programs) {
            const programStartTime = new Date(`${program.date}T${program.startTime}:00`);
            const programEndTime = new Date(programStartTime.getTime() + program.duration * 1000);

            // Transition from scheduled to live
            if (program.status === 'scheduled' && now >= programStartTime && now < programEndTime) {
                program.status = 'live';
                await program.save();
                broadcastEvent('PROGRAM_STARTED', program);
            }

            // Transition from live to ended
            else if (program.status === 'live' && now >= programEndTime) {
                program.status = 'ended';
                await program.save();
                broadcastEvent('PROGRAM_ENDED', { programId: program._id });
            }

            // Handle the case where a program is currently live
            else if (program.status === 'live') {
                const currentPlaybackTime = (now.getTime() - programStartTime.getTime()) / 1000;
                broadcastEvent('SYNC_TIME', {
                    programId: program._id,
                    currentPlaybackTime,
                });
            }
        }
    } catch (error) {
        console.error('Error in live scheduler:', error);
    }
};

const broadcastEvent = (type, payload) => {
    const wss = getWss();
    if (!wss) return;

    const message = JSON.stringify({ type, payload });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

const startScheduler = () => {
    console.log('Starting PlaymoodTV LIVE scheduler...');
    // Check the schedule every 10 seconds
    schedulerInterval = setInterval(checkSchedule, 10000);
};

const stopScheduler = () => {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        console.log('Stopped PlaymoodTV LIVE scheduler.');
    }
};

module.exports = {
    startScheduler,
    stopScheduler,
};
