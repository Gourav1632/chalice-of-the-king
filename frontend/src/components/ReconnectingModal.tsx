type ReconnectingModalProps = {
  isOpen: boolean;
  message?: string;
};

const ReconnectingModal = ({ isOpen, message }: ReconnectingModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md mx-4 rounded-lg border-4 border-[#3b2d1f] bg-[#1b1a18] p-6 text-center text-white shadow-2xl">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#6b4f2a] border-t-transparent" />
        <h2 className="mb-2 text-xl font-medievalsharp">Reconnecting...</h2>
        <p className="text-sm text-[#d9c9a8]">
          {message ?? "Trying to restore your connection. Please wait."}
        </p>
      </div>
    </div>
  );
};

export default ReconnectingModal;
