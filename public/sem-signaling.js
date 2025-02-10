document.addEventListener('DOMContentLoaded', async () => {
    // Setup das abas
    const tabElements = document.querySelectorAll("[data-tab]");
    const panelElements = document.querySelectorAll("[data-panel]");
    const setActiveTab = (target) => {
        panelElements.forEach((panelElement) => {
            if (panelElement.dataset.panel === target.dataset.tab) {
                panelElement.classList.remove('hidden');
            } else {
                panelElement.classList.add('hidden');
            }
        });
        tabElements.forEach((tabElement) => {
            const spanElement = tabElement.querySelector("span").nextElementSibling;
            if (tabElement.dataset.tab === target.dataset.tab) {
                tabElement.classList.add("text-gray-900");
                tabElement.classList.remove("text-gray-500");
                tabElement.setAttribute("aria-current", "page");
                spanElement.classList.remove("bg-transparent")
                spanElement.classList.add("bg-indigo-500")

            } else {
                tabElement.classList.remove("text-gray-900");
                tabElement.classList.add("text-gray-500");
                tabElement.removeAttribute("aria-current");
                spanElement.classList.add("bg-transparent")
                spanElement.classList.remove("bg-indigo-500")
            }
        });
    }
    tabElements.forEach((tab) => {
        tab.addEventListener("click", (e) => {
            e.preventDefault();
            setActiveTab(tab);
        });
    });

    // Cria a conexão WebRTC, usado como caller ou callee
    const peerConnection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    // Adiciona o stream local de vídeo e áudio 
    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Define a fonte do vídeo local
    const localVideo = document.getElementById("local-video");
    localVideo.srcObject = localStream;

    // Quando o evento ontrack é disparado, define a fonte do vídeo remoto
    const remoteVideo = document.getElementById("remote-video");
    peerConnection.ontrack = ({ track, streams }) => {
        track.onunmute = () => {
            if (!remoteVideo.srcObject) {
                remoteVideo.srcObject = streams[0];
            }
        };
    };

    const setButtonLoading = (element) => {
        element.classList.add("opacity-50", "cursor-not-allowed");
        element.setAttribute("disabled", "disabled");
    }
    const removeButtonLoading = (element) => {
        element.classList.remove("opacity-50", "cursor-not-allowed");
        element.removeAttribute("disabled");
    }

    // Wrapper para o evento onicecandidate, que só é disparado quando 
    // o último candidato ICE é gerado (visto que não temos signaling server),
    // perceba que é necessário sempre que se quer definir uma descrição local
    const onLastICECandidate = (handler) => async (event) => {
        if (event.candidate !== null) {
            console.log("Novo candidato ICE:", event.candidate);
        } else {
            console.log("Último candidato ICE gerado");
            const sdp = JSON.stringify(peerConnection.localDescription);
            await navigator.clipboard.writeText(sdp);
            handler();
        }
    }

    const createOfferElement = document.getElementById("create-offer");
    const createOfferFeedbackElement = document.getElementById("create-offer-feedback");

    createOfferElement.addEventListener("click", async () => {
        try {
            setButtonLoading(createOfferElement);
            const createOfferElementInnerHTML = createOfferElement.innerHTML;
            createOfferFeedbackElement.innerHTML = "Gerando oferta...";
            peerConnection.onicecandidate = onLastICECandidate(() => {
                removeButtonLoading(createOfferElement)
                createOfferElement.innerHTML = createOfferElementInnerHTML;
                createOfferFeedbackElement.innerHTML = "Oferta copiada para área de transferência";
            })
            
            // Cria a oferta e define como descrição local
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
        } catch (error) {
            console.error("Erro ao criar oferta:", error);
        }
    });

    
    const receiveAnswerElement = document.getElementById("receive-answer");
    const receiveAnswerFeedbackElement = document.getElementById("receive-answer-feedback");

    receiveAnswerElement.addEventListener("click", async () => {
        try {
            setButtonLoading(receiveAnswerElement);
            receiveAnswerFeedbackElement.innerHTML = "Copiando resposta...";
            
            // Recebe a resposta e define como descrição remota
            const answer = JSON.parse(await navigator.clipboard.readText());
            await peerConnection.setRemoteDescription(answer);

            removeButtonLoading(receiveAnswerElement);
            receiveAnswerFeedbackElement.innerHTML = "Resposta copiada";
        } catch (error) {
            console.error("Erro ao receber resposta:", error);
        }
    });

    const receiveOfferElement = document.getElementById("receive-offer");
    const receiveOfferFeedbackElement = document.getElementById("receive-offer-feedback");

    receiveOfferElement.addEventListener("click", async () => {
        try {
            setButtonLoading(receiveOfferElement);
            receiveOfferFeedbackElement.innerHTML = "Copiando oferta...";
            
            // Recebe a oferta e define como descrição remota
            const offer = JSON.parse(await navigator.clipboard.readText());
            await peerConnection.setRemoteDescription(offer);
            
            removeButtonLoading(receiveOfferElement);
            receiveOfferFeedbackElement.innerHTML = "Oferta copiada";
        } catch (error) {
            console.error("Erro ao receber oferta:", error);
        }
    });

    const createAnswerElement = document.getElementById("create-answer");
    const createAnswerFeedbackElement = document.getElementById("create-answer-feedback");

    createAnswerElement.addEventListener("click", async () => {
        try {
            setButtonLoading(createAnswerElement);
            createAnswerFeedbackElement.innerHTML = "Gerando resposta...";
            peerConnection.onicecandidate = onLastICECandidate(() => {
                removeButtonLoading(createAnswerElement);
                createAnswerFeedbackElement.innerHTML = "Resposta copiada para área de transferência";
            })
            
            // Cria a resposta e define como descrição local
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
        } catch (error) {
            console.error("Erro ao criar resposta:", error);
        }
    });
});



