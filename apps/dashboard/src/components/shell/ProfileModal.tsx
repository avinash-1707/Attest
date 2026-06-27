'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { useUpdateProfile } from '@/lib/hooks';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

type ModalState = 'idle' | 'dirty' | 'uploading' | 'saving' | 'error' | 'success';

const ACCEPTED = 'image/png,image/jpeg,image/webp';
const MAX_BYTES_DISPLAY = 5 * 1024 * 1024;

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { data: session } = useSession();
  const mutation = useUpdateProfile();

  const user = session?.user;
  const savedName = user?.name ?? '';
  const savedImage = user?.image ?? null;

  const [name, setName] = useState(savedName);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingObjectUrl, setPendingObjectUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [nameError, setNameError] = useState('');
  const [fileError, setFileError] = useState('');
  const [modalState, setModalState] = useState<ModalState>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens with latest session data.
  useEffect(() => {
    if (open) {
      setName(session?.user?.name ?? '');
      setPendingFile(null);
      setPendingObjectUrl(null);
      setRemovePhoto(false);
      setNameError('');
      setFileError('');
      setModalState('idle');
      mutation.reset();
    }
  }, [open]);

  // Clean up object URL when it changes or modal closes.
  useEffect(() => {
    return () => {
      if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    };
  }, [pendingObjectUrl]);

  const isDirty =
    name !== savedName ||
    pendingFile !== null ||
    removePhoto;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setFileError('Select a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES_DISPLAY) {
      setFileError('File exceeds 5 MB. Choose a smaller image.');
      return;
    }

    setFileError('');
    setRemovePhoto(false);
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    const url = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingObjectUrl(url);
    setModalState('dirty');
  }

  function handleRemovePhoto() {
    setFileError('');
    if (pendingObjectUrl) {
      URL.revokeObjectURL(pendingObjectUrl);
      setPendingObjectUrl(null);
    }
    setPendingFile(null);
    setRemovePhoto(true);
    setModalState('dirty');
  }

  function handleCancel() {
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    setPendingObjectUrl(null);
    onClose();
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Name is required.');
      return;
    }
    setNameError('');
    setFileError('');

    const phase = pendingFile ? 'uploading' : 'saving';
    setModalState(phase);

    try {
      await mutation.mutateAsync({
        name: name.trim(),
        file: pendingFile,
        removePhoto,
      });

      if (pendingObjectUrl) {
        URL.revokeObjectURL(pendingObjectUrl);
        setPendingObjectUrl(null);
      }
      setPendingFile(null);
      setModalState('success');
      onClose();
    } catch (err) {
      setModalState('error');
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      setFileError(message);
    }
  }

  const previewSrc = pendingObjectUrl ?? (removePhoto ? null : savedImage);
  const hasAvatar = !!savedImage || !!pendingFile;
  const canRemove = (hasAvatar || !!pendingFile) && !removePhoto;
  const isBusy = modalState === 'uploading' || modalState === 'saving';

  const saveLabel =
    modalState === 'uploading'
      ? 'Uploading...'
      : modalState === 'saving'
      ? 'Saving...'
      : 'Save';

  return (
    <Modal open={open} onClose={handleCancel} title="Edit profile" width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Avatar section */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
        >
          <Avatar src={previewSrc} name={name || savedName} size={64} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              aria-label="Upload photo"
            />
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {pendingFile ? 'Change photo' : 'Upload photo'}
            </Button>
            {canRemove && (
              <button
                type="button"
                disabled={isBusy}
                onClick={handleRemovePhoto}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-fail-text)',
                  padding: 0,
                  textAlign: 'left',
                  opacity: isBusy ? 0.5 : 1,
                  transition: 'opacity 80ms ease-out',
                }}
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        {fileError && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-fail-text)',
              margin: 0,
            }}
          >
            {fileError}
          </p>
        )}

        {/* Name field */}
        <Field label="Display name" htmlFor="profile-name" error={nameError} required>
          <Input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameError('');
              setModalState('dirty');
            }}
            placeholder="Your name"
            disabled={isBusy}
            error={nameError}
            autoComplete="name"
          />
        </Field>

        {/* Email read-only */}
        <Field label="Email" htmlFor="profile-email">
          <Input
            id="profile-email"
            type="email"
            value={user?.email ?? ''}
            disabled
            readOnly
            style={{ opacity: 0.6, cursor: 'not-allowed' }}
          />
        </Field>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            justifyContent: 'flex-end',
            paddingTop: 'var(--space-2)',
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={isBusy}
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            loading={isBusy}
            disabled={!isDirty || isBusy}
            onClick={handleSave}
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
