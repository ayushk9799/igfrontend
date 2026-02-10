import React from 'react';

import LikelyToCard from './LikelyToCard';
import NeverHaveIEverCard from './NeverHaveIEverCard';
import TakePhotoCard from './TakePhotoCard';
import DeepCard from './DeepCard';
import SliderCard from './SliderCard';
import VoiceRecordCard from './VoiceRecordCard';

/**
 * TaskCard - Routes to the appropriate card component based on task category
 */
const TaskCard = React.memo(({
    task,
    index,
    totalCards,
    partnerName,
    userName,
    userAvatar,
    partnerAvatar,
    userId,
    partnerId,
    hasPartner = false,
    onLinkPartner,
    onSubmit,
    onSkip,
    isLastCard,
    onAnswerSubmit,
    isAnswered = false,
    previousAnswer = null,
    autoAdvanceOnSubmit = true
}) => {
    if (!task) return null;

    const commonProps = {
        task,
        index,
        totalCards,
        partnerName,
        userName,
        userAvatar,
        partnerAvatar,
        userId,
        partnerId,
        hasPartner,
        onLinkPartner,
        onSubmit,
        onSkip,
        isLastCard,
        onAnswerSubmit,
        isAnswered,
        previousAnswer,
        autoAdvanceOnSubmit
    };

    if (task.category === 'likelyto') {
        return <LikelyToCard {...commonProps} />;
    }

    if (task.category === 'neverhaveiever') {
        return <NeverHaveIEverCard {...commonProps} />;
    }

    if (task.category === 'takephoto') {
        return <TakePhotoCard {...commonProps} />;
    }

    if (task.category === 'slider') {
        return <SliderCard {...commonProps} />;
    }

    if (task.category === 'voicerecord') {
        return <VoiceRecordCard {...commonProps} />;
    }

    return <DeepCard {...commonProps} />;
});

export default TaskCard;

