document.addEventListener('DOMContentLoaded', async () => {
    const uuid = crypto.randomUUID();
    const peers = new Map();
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    const body = document.getElementsByTagName("body")[0];

    const localVideo = createVideo(uuid);
    localVideo.muted = true;
    localVideo.srcObject = stream;
    body.appendChild(localVideo);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${wsProtocol}://${window.location.host}`);

    const getOrCreatePeer = (remoteUUID) => {
        let peer = peers.get(remoteUUID);
        if (!peer) {
            peer = createPeer({
                ws,
                stream,
                localUUID: uuid,
                remoteUUID,
            });
            body.appendChild(peer.video);
            peers.set(remoteUUID, peer);
            peer.connection.addEventListener("close", () => {
                peers.delete(remoteUUID)
                body.removeChild(peer.video);
            });
        }
        return peer;
    }

    let heartbeatInterval = null;

    ws.addEventListener("open", () => {
        console.log("Conexão WebSocket estabelecida.");
        const heartbeat = JSON.stringify({
            type: "heartbeat",
            from: uuid,
        })
        ws.send(heartbeat);
        heartbeatInterval = setInterval(() => {
            ws.send(heartbeat);
        }, 15000);
    })

    ws.addEventListener("close", () => {
        console.log("Conexão WebSocket fechada.");
        clearInterval(heartbeatInterval);
    });

    ws.addEventListener("message", async (event) => {
        const message = JSON.parse(await event.data.text());
        if (message.to && message.to !== uuid) return;
        await getOrCreatePeer(message.from).handleMessage(message);
    })

});

function createVideo(uuid) {
    const video = document.createElement("video");
    video.id = `video-${uuid}`;
    video.autoplay = true;
    video.playsInline = true;
    video.className = 'w-64 aspect-video bg-black rounded object-cover';
    return video;
}

function createPeer({ ws, stream: localStream, localUUID, remoteUUID }) {
    const remoteVideo = createVideo(remoteUUID);

    let isMakingOffer = false;
    const isPolite = localUUID < remoteUUID;
    let ignoreOffer = false;

    const connection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    for (const track of localStream.getTracks()) {
        connection.addTrack(track, localStream);
    }

    connection.addEventListener('track', ({ track, streams }) => {
        track.onunmute = () => {
            if (!remoteVideo.srcObject) {
                remoteVideo.srcObject = streams[0];
            }
        };
    });

    connection.addEventListener('negotiationneeded', async () => {
        try {
            isMakingOffer = true;
            await connection.setLocalDescription();
            ws.send(JSON.stringify({
                type: 'description',
                from: localUUID,
                to: remoteUUID,
                description: connection.localDescription,
            }));
        } catch (error) {
            console.error('Erro na negociação:', error);
        } finally {
            isMakingOffer = false;
        }
    });

    connection.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                type: 'candidate',
                from: localUUID,
                to: remoteUUID,
                candidate: event.candidate,
            }));
        }
    });

    connection.addEventListener('iceconnectionstatechange', () => {
        if (connection.iceConnectionState === 'failed') {
            connection.restartIce();
        }
    });

    const handleDescription = async (description) => {
        try {
            const isOfferDescription = description.type === "offer";
            const isSignalingStable = connection.signalingState === "stable";
            const isOfferCollision = isOfferDescription && (isMakingOffer || !isSignalingStable);
            ignoreOffer = !isPolite && isOfferCollision;

            if (ignoreOffer) return;

            await connection.setRemoteDescription(description);
            if (isOfferDescription) {
                await connection.setLocalDescription();
                ws.send(JSON.stringify({
                    type: "description",
                    from: localUUID,
                    to: remoteUUID,
                    description: connection.localDescription
                }));
            }
        } catch (err) {
            console.error(err);
        }
    }

    const handleCandidate = async (candidate) => {
        try {
            await connection.addIceCandidate(candidate);
        } catch (err) {
            if (!ignoreOffer) console.error(err);
        }
    }

    const handleMessage = async (message) => {
        if (message.type === "description") {
            await handleDescription(message.description);
        } else if (message.type === "candidate") {
            await handleCandidate(message.candidate);
        }
    }

    return { connection, video: remoteVideo, handleMessage };
}





