import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

const PwaInstallContext = createContext(null);

const getPlatform = ({ windowObj = window, navigatorObj = navigator } = {}) => {
  const platform = navigatorObj?.platform || '';
  const userAgent = navigatorObj?.userAgent || '';
  const touchPoints = Number(navigatorObj?.maxTouchPoints || 0);
  const isIos = /iPhone|iPad|iPod/i.test(userAgent)
    || /iPhone|iPad|iPod/i.test(platform)
    || (platform === 'MacIntel' && touchPoints > 1 && 'ontouchend' in windowObj);

  if (isIos) return 'ios';
  return 'web';
};

const isStandaloneMode = ({ windowObj = window, navigatorObj = navigator } = {}) => Boolean(
  windowObj?.matchMedia?.('(display-mode: standalone)')?.matches
  || navigatorObj?.standalone === true
);

const getRuntimeStatus = (environment, deferredPrompt = null) => {
  if (isStandaloneMode(environment)) return 'installed';
  if (getPlatform(environment) === 'ios') return 'manualInstall';
  if (deferredPrompt) return 'installable';
  return 'unavailable';
};

export function PwaInstallProvider({
  children,
  windowObj = window,
  navigatorObj = navigator
}) {
  const environment = useMemo(() => ({
    windowObj,
    navigatorObj
  }), [navigatorObj, windowObj]);
  const deferredPromptRef = useRef(null);
  const promptInFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const [status, setStatus] = useState(() => getRuntimeStatus(environment));

  const platform = getPlatform(environment);

  const resetRuntimeStatus = useCallback(() => {
    setStatus((currentStatus) => {
      if (currentStatus === 'installed') return 'installed';
      return getRuntimeStatus(environment, deferredPromptRef.current);
    });
  }, [environment]);

  useEffect(() => {
    mountedRef.current = true;
    resetRuntimeStatus();

    const handleBeforeInstallPrompt = (event) => {
      if (isStandaloneMode(environment)) {
        deferredPromptRef.current = null;
        promptInFlightRef.current = false;
        setStatus('installed');
        return;
      }

      event.preventDefault();
      deferredPromptRef.current = event;
      setStatus('installable');
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      promptInFlightRef.current = false;
      setStatus('installed');
    };

    windowObj.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    windowObj.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mountedRef.current = false;
      deferredPromptRef.current = null;
      promptInFlightRef.current = false;
      windowObj.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      windowObj.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [environment, resetRuntimeStatus, windowObj]);

  const dismissInstall = useCallback(() => {
    deferredPromptRef.current = null;
    promptInFlightRef.current = false;
    setStatus((currentStatus) => (
      currentStatus === 'installed' ? 'installed' : 'dismissed'
    ));
  }, []);

  const promptInstall = useCallback(async () => {
    const promptEvent = deferredPromptRef.current;

    if (!promptEvent || promptInFlightRef.current) {
      return {
        outcome: 'unavailable',
        platform
      };
    }

    promptInFlightRef.current = true;
    setStatus('prompting');

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      const outcome = choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';

      deferredPromptRef.current = null;
      promptInFlightRef.current = false;

      if (mountedRef.current) {
        setStatus((currentStatus) => {
          if (currentStatus === 'installed') return 'installed';
          return outcome === 'accepted'
            ? getRuntimeStatus(environment)
            : 'dismissed';
        });
      }

      return {
        outcome,
        platform
      };
    } catch {
      deferredPromptRef.current = null;
      promptInFlightRef.current = false;

      if (mountedRef.current) {
        resetRuntimeStatus();
      }

      return {
        outcome: 'unavailable',
        platform
      };
    }
  }, [environment, platform, resetRuntimeStatus]);

  const value = useMemo(() => ({
    status,
    platform,
    isInstalled: status === 'installed',
    isInstallable: status === 'installable',
    isManualInstall: status === 'manualInstall',
    isPrompting: status === 'prompting',
    isDismissed: status === 'dismissed',
    canPrompt: status === 'installable' && Boolean(deferredPromptRef.current),
    promptInstall,
    dismissInstall
  }), [dismissInstall, platform, promptInstall, status]);

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  );
}

export const usePwaInstall = () => {
  const context = useContext(PwaInstallContext);

  if (!context) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider');
  }

  return context;
};
