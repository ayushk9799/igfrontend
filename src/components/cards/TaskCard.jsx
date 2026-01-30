import React from 'react';

import LikelyToCard from './LikelyToCard';
import NeverHaveIEverCard from './NeverHaveIEverCard';
import TakePhotoCard from './TakePhotoCard';
import DeepCard from './DeepCard';
import SliderCard from './SliderCard';

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
    onSubmit,
    onSkip,
    isLastCard,
    onAnswerSubmit,
    isAnswered = false,
    previousAnswer = null
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
        onSubmit,
        onSkip,
        isLastCard,
        onAnswerSubmit,
        isAnswered,
        previousAnswer
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

    return <DeepCard {...commonProps} />;
});

export default TaskCard;

