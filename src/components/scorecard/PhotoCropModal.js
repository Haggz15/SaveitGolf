import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

// Matches the [9, 16] aspect ImagePicker requests on native (allowsEditing
// there already shows the OS's own pinch/pan crop UI, so this component is
// only ever mounted on web — see handlePickPhotoWeb in ScorecardScreen /
// ScorecardDetailModal).
const BOX_WIDTH = 220;
const BOX_HEIGHT = Math.round((BOX_WIDTH / 9) * 16);
const MAX_OUTPUT_WIDTH = 900;

// Web-only pan-to-crop step shown after a photo is picked from the file
// input. The photo is dragged behind a fixed 9:16 window and, on "Use
// Photo", the visible rectangle is baked into a real cropped image (via
// canvas) before it's ever handed to the caller — so no separate
// offset/scale state needs to travel any further than this component.
export default function PhotoCropModal({ visible, photoUri, onCancel, onConfirm }) {
  const [imgSize, setImgSize] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!visible || !photoUri) {
      setImgSize(null);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      const baseScale = Math.max(BOX_WIDTH / img.naturalWidth, BOX_HEIGHT / img.naturalHeight);
      const dispW = img.naturalWidth * baseScale;
      const dispH = img.naturalHeight * baseScale;
      setImgSize({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, baseScale, dispW, dispH });
      setOffset({ x: (BOX_WIDTH - dispW) / 2, y: (BOX_HEIGHT - dispH) / 2 });
    };
    img.src = photoUri;
  }, [visible, photoUri]);

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function clampOffset(next, size) {
    if (!size) return next;
    const minX = BOX_WIDTH - size.dispW;
    const minY = BOX_HEIGHT - size.dispH;
    return { x: clamp(next.x, minX, 0), y: clamp(next.y, minY, 0) };
  }

  function handlePointerDown(e) {
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, offsetX: offset.x, offsetY: offset.y };
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset({ x: dragRef.current.offsetX + dx, y: dragRef.current.offsetY + dy }, imgSize));
  }

  function handlePointerUp() {
    dragRef.current = null;
    setDragging(false);
  }

  function handleUsePhoto() {
    if (!imgSize) return;
    const cropX = (0 - offset.x) / imgSize.baseScale;
    const cropY = (0 - offset.y) / imgSize.baseScale;
    const cropWidth = BOX_WIDTH / imgSize.baseScale;
    const cropHeight = BOX_HEIGHT / imgSize.baseScale;

    const outputWidth = Math.min(MAX_OUTPUT_WIDTH, cropWidth);
    const outputHeight = (outputWidth / cropWidth) * cropHeight;

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.onload = () => {
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
      canvas.toBlob(
        (blob) => {
          onConfirm(URL.createObjectURL(blob));
        },
        'image/jpeg',
        0.92
      );
    };
    img.src = photoUri;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Text style={styles.title}>Drag to reposition</Text>
        <View style={styles.box}>
          {imgSize && (
            // eslint-disable-next-line react/no-unknown-property
            <div
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              style={{
                width: '100%',
                height: '100%',
                cursor: dragging ? 'grabbing' : 'grab',
                overflow: 'hidden',
                touchAction: 'none',
              }}
            >
              <img
                src={photoUri}
                draggable={false}
                alt=""
                style={{
                  width: imgSize.dispW,
                  height: imgSize.dispH,
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            </div>
          )}
        </View>
        <Text style={styles.hint}>Drag to choose which part of the photo shows</Text>
        <View style={styles.buttonsRow}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton} activeOpacity={0.85}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleUsePhoto}
            style={[styles.useButton, !imgSize && styles.useButtonDisabled]}
            activeOpacity={0.85}
            disabled={!imgSize}
          >
            <Text style={styles.useButtonText}>Use Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.white,
    fontFamily: 'Cinzel_700Bold',
    fontSize: 14,
    marginBottom: 16,
  },
  box: {
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.brightGreen,
    overflow: 'hidden',
    backgroundColor: colors.navyCard,
  },
  hint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 10,
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: 14,
  },
  useButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: colors.brightGreen,
  },
  useButtonDisabled: {
    opacity: 0.5,
  },
  useButtonText: {
    color: colors.brightGreenText,
    fontSize: 14,
    fontWeight: '700',
  },
});
