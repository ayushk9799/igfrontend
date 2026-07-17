const CANDIDATE_TYPE_PATTERN = /\btyp\s+(host|srflx|prflx|relay)\b/i;

export const getCandidateType = (candidate) => {
    const value = typeof candidate === 'string' ? candidate : candidate?.candidate;
    return value?.match(CANDIDATE_TYPE_PATTERN)?.[1]?.toLowerCase() || 'unknown';
};

const statsToArray = (report) => {
    const values = [];
    if (report?.forEach) {
        report.forEach(value => values.push(value));
    } else if (Array.isArray(report)) {
        values.push(...report);
    } else if (report && typeof report === 'object') {
        values.push(...Object.values(report));
    }
    return values;
};

export const collectSanitizedStats = async (peerConnection) => {
    if (!peerConnection) return {};

    try {
        const reports = statsToArray(await peerConnection.getStats());
        const byId = new Map(reports.filter(report => report?.id).map(report => [report.id, report]));
        const selectedTransport = reports.find(report => report.type === 'transport' && report.selectedCandidatePairId);
        const selectedPair = reports.find(report => (
            report.type === 'candidate-pair'
            && (report.selected || report.nominated || report.id === selectedTransport?.selectedCandidatePairId)
            && report.state === 'succeeded'
        ));
        const localCandidate = byId.get(selectedPair?.localCandidateId);
        const remoteCandidate = byId.get(selectedPair?.remoteCandidateId);
        const inbound = reports.filter(report => report.type === 'inbound-rtp' && !report.isRemote);
        const outbound = reports.filter(report => report.type === 'outbound-rtp' && !report.isRemote);
        const mediaKind = report => report.kind || report.mediaType;
        const sumFor = (items, kind, field) => items
            .filter(report => mediaKind(report) === kind)
            .reduce((sum, report) => sum + Math.max(0, Number(report[field]) || 0), 0);

        return {
            selectedCandidatePair: selectedPair ? {
                localType: localCandidate?.candidateType || 'unknown',
                remoteType: remoteCandidate?.candidateType || 'unknown',
                protocol: String(localCandidate?.protocol || remoteCandidate?.protocol || 'unknown').toLowerCase(),
            } : undefined,
            roundTripTimeMs: Number.isFinite(selectedPair?.currentRoundTripTime)
                ? Math.round(selectedPair.currentRoundTripTime * 1000)
                : undefined,
            packetsLost: inbound.reduce((sum, report) => sum + Math.max(0, Number(report.packetsLost) || 0), 0),
            outboundAudioBytes: sumFor(outbound, 'audio', 'bytesSent'),
            outboundVideoBytes: sumFor(outbound, 'video', 'bytesSent'),
            inboundAudioBytes: sumFor(inbound, 'audio', 'bytesReceived'),
            inboundVideoBytes: sumFor(inbound, 'video', 'bytesReceived'),
            videoFramesEncoded: sumFor(outbound, 'video', 'framesEncoded'),
            videoFramesDecoded: sumFor(inbound, 'video', 'framesDecoded'),
        };
    } catch (error) {
        return {};
    }
};
