import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
    Canvas,
    CubicSampling,
    Group,
    Image as SkiaImage,
    Path,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
    runOnJS,
    useAnimatedStyle,
} from 'react-native-reanimated';

export const TRAY_ITEM_GAP = 16;

const PieceBevel = ({ path, edgePaths, hiddenEdges = {} }) => {
    const hasHiddenEdges = Object.values(hiddenEdges).some(Boolean);
    const visiblePaths = hasHiddenEdges
        ? Object.entries(edgePaths || {})
            .filter(([edge]) => !hiddenEdges[edge])
            .map(([, edgePath]) => edgePath)
        : [path];

    return visiblePaths.map((edgePath, index) => (
        <React.Fragment key={`bevel-${index}`}>
            <Group transform={[{ translateX: -0.45 }, { translateY: -0.45 }]}>
                <Path
                    path={edgePath}
                    color="rgba(255, 255, 255, 0.42)"
                    style="stroke"
                    strokeWidth={1.1}
                    strokeJoin="round"
                    strokeCap="round"
                />
            </Group>
            <Group transform={[{ translateX: 0.55 }, { translateY: 0.7 }]}>
                <Path
                    path={edgePath}
                    color="rgba(44, 20, 72, 0.18)"
                    style="stroke"
                    strokeWidth={1.25}
                    strokeJoin="round"
                    strokeCap="round"
                />
            </Group>
        </React.Fragment>
    ));
};

const PieceDrawing = React.memo(({
    image,
    originalIndex,
    gridDim,
    pieceSize,
    tabSize,
    scaledImgW,
    scaledImgH,
    imgOffsetX,
    imgOffsetY,
    geometry,
    hiddenEdges,
}) => {
    const originalRow = Math.floor(originalIndex / gridDim);
    const originalCol = originalIndex % gridDim;
    const pieceGeometry = geometry[originalIndex];
    if (!pieceGeometry) return null;

    return (
        <>
            <Group clip={pieceGeometry.path}>
                <SkiaImage
                    image={image}
                    x={tabSize - originalCol * pieceSize + imgOffsetX}
                    y={tabSize - originalRow * pieceSize + imgOffsetY}
                    width={scaledImgW}
                    height={scaledImgH}
                    fit="fill"
                    sampling={CubicSampling}
                />
            </Group>
            <PieceBevel
                path={pieceGeometry.path}
                edgePaths={pieceGeometry.edgePaths}
                hiddenEdges={hiddenEdges}
            />
        </>
    );
});

PieceDrawing.displayName = 'PieceDrawing';

export const JigsawBoardCanvas = React.memo(({
    image,
    pieces,
    geometry,
    gridDim,
    pieceSize,
    tabSize,
    actualPuzzleSize,
    scaledImgW,
    scaledImgH,
    imgOffsetX,
    imgOffsetY,
    activeSourceSlot,
    isSolved,
    showCorrect,
}) => {
    const canvasSize = actualPuzzleSize + 2 * tabSize;
    const visibleSlots = useMemo(() => pieces.map((value) => (
        showCorrect || value >= 0
    )), [pieces, showCorrect]);

    return (
        <Canvas
            style={[
                styles.boardCanvas,
                {
                    left: -tabSize,
                    top: -tabSize,
                    width: canvasSize,
                    height: canvasSize,
                },
            ]}
            pointerEvents="none"
        >
            {/* Slot guides always stay behind image pixels. Rendering guides
                and pieces in separate passes prevents a later empty slot from
                painting a stroke across an earlier placed piece. */}
            {pieces.map((value, slotIndex) => {
                const row = Math.floor(slotIndex / gridDim);
                const col = slotIndex % gridDim;
                const originalIndex = showCorrect ? slotIndex : value;
                const isVisible = originalIndex >= 0 && slotIndex !== activeSourceSlot;
                const slotGeometry = geometry[slotIndex];

                if (isVisible || isSolved || !slotGeometry) return null;

                return (
                    <Group
                        key={`empty-${slotIndex}`}
                        transform={[
                            { translateX: col * pieceSize },
                            { translateY: row * pieceSize },
                        ]}
                    >
                        <Path
                            path={slotGeometry.path}
                            color="rgba(255, 255, 255, 0.55)"
                            style="stroke"
                            strokeWidth={1.5}
                            strokeJoin="round"
                        />
                    </Group>
                );
            })}

            {pieces.map((value, slotIndex) => {
                const row = Math.floor(slotIndex / gridDim);
                const col = slotIndex % gridDim;
                const originalIndex = showCorrect ? slotIndex : value;
                const isVisible = originalIndex >= 0 && slotIndex !== activeSourceSlot;
                const isCorrectPlacement = value === slotIndex;

                if (!isVisible) return null;

                const hiddenEdges = {
                    top: row > 0 && visibleSlots[slotIndex - gridDim],
                    right: col < gridDim - 1 && visibleSlots[slotIndex + 1],
                    bottom: row < gridDim - 1 && visibleSlots[slotIndex + gridDim],
                    left: col > 0 && visibleSlots[slotIndex - 1],
                };

                return (
                    <Group
                        key={`piece-${slotIndex}-${originalIndex}`}
                        transform={[
                            { translateX: col * pieceSize },
                            { translateY: row * pieceSize },
                        ]}
                    >
                        <PieceDrawing
                            image={image}
                            originalIndex={originalIndex}
                            gridDim={gridDim}
                            pieceSize={pieceSize}
                            tabSize={tabSize}
                            scaledImgW={scaledImgW}
                            scaledImgH={scaledImgH}
                            imgOffsetX={imgOffsetX}
                            imgOffsetY={imgOffsetY}
                            geometry={geometry}
                            hiddenEdges={hiddenEdges}
                        />
                        {isCorrectPlacement && !isSolved && (
                            <Path
                                path={geometry[originalIndex].path}
                                color="#22C55E"
                                style="stroke"
                                strokeWidth={2.25}
                                strokeJoin="round"
                                strokeCap="round"
                            />
                        )}
                    </Group>
                );
            })}
        </Canvas>
    );
});

JigsawBoardCanvas.displayName = 'JigsawBoardCanvas';

export const getTrayContentWidth = (pieceCount, itemSize) => (
    Math.max(1, pieceCount * itemSize + Math.max(0, pieceCount - 1) * TRAY_ITEM_GAP)
);

export const JigsawTrayCanvas = React.memo(({
    image,
    pieceIndices,
    geometry,
    activeOriginalIndex,
    gridDim,
    pieceSize,
    tabSize,
    scaledImgW,
    scaledImgH,
    imgOffsetX,
    imgOffsetY,
    itemSize,
}) => {
    const outerSize = pieceSize + 2 * tabSize;
    const scale = itemSize / outerSize;
    const contentWidth = getTrayContentWidth(pieceIndices.length, itemSize);

    return (
        <Canvas
            style={{ width: contentWidth, height: itemSize }}
            pointerEvents="none"
        >
            {pieceIndices.map((originalIndex, itemIndex) => {
                if (originalIndex === activeOriginalIndex) return null;
                return (
                    <Group
                        key={`tray-${originalIndex}`}
                        transform={[
                            { translateX: itemIndex * (itemSize + TRAY_ITEM_GAP) },
                        ]}
                    >
                        <Group transform={[{ scale }]}>
                            <PieceDrawing
                                image={image}
                                originalIndex={originalIndex}
                                gridDim={gridDim}
                                pieceSize={pieceSize}
                                tabSize={tabSize}
                                scaledImgW={scaledImgW}
                                scaledImgH={scaledImgH}
                                imgOffsetX={imgOffsetX}
                                imgOffsetY={imgOffsetY}
                                geometry={geometry}
                                hiddenEdges={{}}
                            />
                        </Group>
                    </Group>
                );
            })}
        </Canvas>
    );
});

JigsawTrayCanvas.displayName = 'JigsawTrayCanvas';

export const JigsawPieceGestureTarget = React.memo(({
    originalIndex,
    sourceSlot,
    isTray,
    enabled,
    style,
    dragX,
    dragY,
    dragOriginX,
    dragOriginY,
    onDragStart,
    onDragEnd,
    onDragCancel,
}) => {
    const gesture = useMemo(() => {
        let pan = Gesture.Pan()
            .enabled(enabled)
            .onStart((event) => {
                dragX.value = event.absoluteX;
                dragY.value = event.absoluteY;
                dragOriginX.value = event.absoluteX;
                dragOriginY.value = event.absoluteY;
                runOnJS(onDragStart)(
                    originalIndex,
                    sourceSlot,
                    event.absoluteX,
                    event.absoluteY
                );
            })
            .onUpdate((event) => {
                dragX.value = event.absoluteX;
                dragY.value = event.absoluteY;
            })
            .onEnd((event) => {
                runOnJS(onDragEnd)(
                    originalIndex,
                    sourceSlot,
                    event.absoluteX,
                    event.absoluteY
                );
            })
            .onFinalize((_event, success) => {
                if (!success) {
                    runOnJS(onDragCancel)();
                }
            });

        pan = isTray
            ? pan.activeOffsetY([-6, 6]).failOffsetX([-10, 10])
            : pan.minDistance(2);
        return pan;
    }, [
        dragOriginX,
        dragOriginY,
        dragX,
        dragY,
        enabled,
        isTray,
        onDragCancel,
        onDragEnd,
        onDragStart,
        originalIndex,
        sourceSlot,
    ]);

    return (
        <GestureDetector gesture={gesture}>
            <Reanimated.View
                style={[styles.hitTarget, style]}
                collapsable={false}
            />
        </GestureDetector>
    );
});

JigsawPieceGestureTarget.displayName = 'JigsawPieceGestureTarget';

export const JigsawDraggedPiece = React.memo(({
    image,
    originalIndex,
    geometry,
    gridDim,
    pieceSize,
    tabSize,
    scaledImgW,
    scaledImgH,
    imgOffsetX,
    imgOffsetY,
    dragX,
    dragY,
}) => {
    const outerSize = pieceSize + 2 * tabSize;
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: dragX.value - outerSize / 2 },
            { translateY: dragY.value - outerSize / 2 },
            { scale: 1.08 },
        ],
    }), [outerSize]);

    return (
        <Reanimated.View
            style={[
                styles.draggedPiece,
                { width: outerSize, height: outerSize },
                animatedStyle,
            ]}
            pointerEvents="none"
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
        >
            <Canvas style={{ width: outerSize, height: outerSize }} pointerEvents="none">
                <PieceDrawing
                    image={image}
                    originalIndex={originalIndex}
                    gridDim={gridDim}
                    pieceSize={pieceSize}
                    tabSize={tabSize}
                    scaledImgW={scaledImgW}
                    scaledImgH={scaledImgH}
                    imgOffsetX={imgOffsetX}
                    imgOffsetY={imgOffsetY}
                    geometry={geometry}
                    hiddenEdges={{}}
                />
                <Path
                    path={geometry[originalIndex]?.path}
                    color="rgba(255, 255, 255, 0.52)"
                    style="stroke"
                    strokeWidth={1.25}
                    strokeJoin="round"
                />
            </Canvas>
        </Reanimated.View>
    );
});

JigsawDraggedPiece.displayName = 'JigsawDraggedPiece';

const styles = StyleSheet.create({
    boardCanvas: {
        position: 'absolute',
    },
    hitTarget: {
        position: 'absolute',
        backgroundColor: 'transparent',
    },
    draggedPiece: {
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 9999,
        elevation: 99,
        overflow: 'visible',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
    },
});
