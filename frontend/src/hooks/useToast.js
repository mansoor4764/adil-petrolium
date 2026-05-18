import { useToastContext } from '../components/ui/ToastProvider';

export const useToast = () => {
  const ctx = useToastContext();
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
};

export default useToast;
