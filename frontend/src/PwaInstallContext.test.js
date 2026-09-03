import { act, render, screen, waitFor } from '@testing-library/react';
import { PwaInstallProvider, usePwaInstall } from './PwaInstallContext';

function PwaInstallProbe({ onState }) {
  const install = usePwaInstall();
  onState?.(install);

  return (
    <div>
      <div data-testid="status">{install.status}</div>
      <div data-testid="platform">{install.platform}</div>
      <div data-testid="canPrompt">{String(install.canPrompt)}</div>
      <button type="button" onClick={install.promptInstall}>
        prompt
      </button>
      <button type="button" onClick={install.dismissInstall}>
        dismiss
      </button>
    </div>
  );
}

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

const createEnvironment = ({
  standalone = false,
  navigatorStandalone = false,
  userAgent = 'Mozilla/5.0 Chrome',
  platform = 'Linux x86_64',
  maxTouchPoints = 0,
  ontouchend = false
} = {}) => {
  const listeners = new Map();
  const windowObj = {
    matchMedia: jest.fn().mockReturnValue({ matches: standalone }),
    addEventListener: jest.fn((eventName, handler) => {
      listeners.set(eventName, handler);
    }),
    removeEventListener: jest.fn((eventName, handler) => {
      if (listeners.get(eventName) === handler) listeners.delete(eventName);
    })
  };
  const navigatorObj = {
    userAgent,
    platform,
    maxTouchPoints,
    standalone: navigatorStandalone
  };

  if (ontouchend) {
    windowObj.ontouchend = jest.fn();
  }

  return {
    windowObj,
    navigatorObj,
    dispatch(eventName, event) {
      listeners.get(eventName)?.(event);
    },
    listener(eventName) {
      return listeners.get(eventName);
    }
  };
};

const createBeforeInstallPromptEvent = ({ outcome = 'accepted', promptResult } = {}) => ({
  preventDefault: jest.fn(),
  prompt: jest.fn(() => promptResult || Promise.resolve()),
  userChoice: Promise.resolve({ outcome })
});

const renderProvider = (environment, onState) => render(
  <PwaInstallProvider
    windowObj={environment.windowObj}
    navigatorObj={environment.navigatorObj}
  >
    <PwaInstallProbe onState={onState} />
  </PwaInstallProvider>
);

test('beforeinstallprompt previne prompt nativo e passa a installable', () => {
  const environment = createEnvironment();

  renderProvider(environment);

  const event = createBeforeInstallPromptEvent();

  act(() => {
    environment.dispatch('beforeinstallprompt', event);
  });

  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('status')).toHaveTextContent('installable');
  expect(screen.getByTestId('canPrompt')).toHaveTextContent('true');
});

test('promptInstall accepted llama prompt, espera userChoice y limpia deferredPrompt', async () => {
  const environment = createEnvironment();
  let latestState;

  renderProvider(environment, (state) => { latestState = state; });

  const event = createBeforeInstallPromptEvent({ outcome: 'accepted' });

  act(() => {
    environment.dispatch('beforeinstallprompt', event);
  });

  let result;
  await act(async () => {
    result = await latestState.promptInstall();
  });

  expect(event.prompt).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ outcome: 'accepted', platform: 'web' });
  expect(screen.getByTestId('canPrompt')).toHaveTextContent('false');
});

test('promptInstall dismissed llama prompt, marca dismissed y limpia deferredPrompt', async () => {
  const environment = createEnvironment();
  let latestState;

  renderProvider(environment, (state) => { latestState = state; });

  const event = createBeforeInstallPromptEvent({ outcome: 'dismissed' });

  act(() => {
    environment.dispatch('beforeinstallprompt', event);
  });

  await act(async () => {
    await latestState.promptInstall();
  });

  expect(event.prompt).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('status')).toHaveTextContent('dismissed');
  expect(screen.getByTestId('canPrompt')).toHaveTextContent('false');
});

test('doble llamada concurrente no ejecuta prompt dos veces', async () => {
  const environment = createEnvironment();
  const promptDeferred = createDeferred();
  let latestState;

  renderProvider(environment, (state) => { latestState = state; });

  const event = createBeforeInstallPromptEvent({
    outcome: 'accepted',
    promptResult: promptDeferred.promise
  });

  act(() => {
    environment.dispatch('beforeinstallprompt', event);
  });

  let firstResult;
  let secondResult;

  await act(async () => {
    const firstPrompt = latestState.promptInstall().then((result) => {
      firstResult = result;
    });
    const secondPrompt = latestState.promptInstall().then((result) => {
      secondResult = result;
    });

    promptDeferred.resolve();
    await Promise.all([firstPrompt, secondPrompt]);
  });

  expect(event.prompt).toHaveBeenCalledTimes(1);
  expect(firstResult).toEqual({ outcome: 'accepted', platform: 'web' });
  expect(secondResult).toEqual({ outcome: 'unavailable', platform: 'web' });
  expect(screen.getByTestId('canPrompt')).toHaveTextContent('false');
});

test('prompt exception no hace crash, libera lock y limpia prompt', async () => {
  const environment = createEnvironment();
  let latestState;

  renderProvider(environment, (state) => { latestState = state; });

  const event = createBeforeInstallPromptEvent({
    promptResult: Promise.reject(new Error('prompt failed'))
  });

  act(() => {
    environment.dispatch('beforeinstallprompt', event);
  });

  let result;
  await act(async () => {
    result = await latestState.promptInstall();
  });

  expect(event.prompt).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ outcome: 'unavailable', platform: 'web' });
  expect(screen.getByTestId('canPrompt')).toHaveTextContent('false');
});

test('appinstalled pasa a installed, limpia prompt y libera lock', async () => {
  const environment = createEnvironment();
  const promptDeferred = createDeferred();
  let latestState;
  let promptResult;

  renderProvider(environment, (state) => { latestState = state; });

  const event = createBeforeInstallPromptEvent({
    promptResult: promptDeferred.promise
  });

  act(() => {
    environment.dispatch('beforeinstallprompt', event);
  });

  await act(async () => {
    promptResult = latestState.promptInstall();
  });

  act(() => {
    environment.dispatch('appinstalled', new Event('appinstalled'));
  });

  await act(async () => {
    promptDeferred.resolve();
    await promptResult;
  });

  expect(screen.getByTestId('status')).toHaveTextContent('installed');
  expect(screen.getByTestId('canPrompt')).toHaveTextContent('false');
});

test('standalone inicial inicia como installed y no ofrece instalación', () => {
  const environment = createEnvironment({ standalone: true });

  renderProvider(environment);

  expect(screen.getByTestId('status')).toHaveTextContent('installed');
  expect(screen.getByTestId('canPrompt')).toHaveTextContent('false');
});

test('navigator.standalone inicial inicia como installed', () => {
  const environment = createEnvironment({ navigatorStandalone: true });

  renderProvider(environment);

  expect(screen.getByTestId('status')).toHaveTextContent('installed');
});

test('iOS no standalone expone manualInstall', () => {
  const environment = createEnvironment({
    userAgent: 'Mozilla/5.0 iPhone',
    platform: 'iPhone'
  });

  renderProvider(environment);

  expect(screen.getByTestId('status')).toHaveTextContent('manualInstall');
  expect(screen.getByTestId('platform')).toHaveTextContent('ios');
});

test('iPadOS como MacIntel con touch points expone manualInstall', () => {
  const environment = createEnvironment({
    userAgent: 'Mozilla/5.0 Macintosh',
    platform: 'MacIntel',
    maxTouchPoints: 5,
    ontouchend: true
  });

  renderProvider(environment);

  expect(screen.getByTestId('status')).toHaveTextContent('manualInstall');
  expect(screen.getByTestId('platform')).toHaveTextContent('ios');
});

test('cleanup remueve listeners al desmontar', () => {
  const environment = createEnvironment();
  const { unmount } = renderProvider(environment);

  const beforeInstallPromptListener = environment.listener('beforeinstallprompt');
  const appInstalledListener = environment.listener('appinstalled');

  unmount();

  expect(environment.windowObj.removeEventListener).toHaveBeenCalledWith(
    'beforeinstallprompt',
    beforeInstallPromptListener
  );
  expect(environment.windowObj.removeEventListener).toHaveBeenCalledWith(
    'appinstalled',
    appInstalledListener
  );
});

test('no dispara prompt automáticamente al recibir beforeinstallprompt', () => {
  const environment = createEnvironment();

  renderProvider(environment);

  const event = createBeforeInstallPromptEvent();

  act(() => {
    environment.dispatch('beforeinstallprompt', event);
  });

  expect(event.prompt).not.toHaveBeenCalled();
});

test('ausencia inicial de beforeinstallprompt mantiene unavailable sin crash', async () => {
  const environment = createEnvironment();

  renderProvider(environment);

  await waitFor(() => {
    expect(screen.getByTestId('status')).toHaveTextContent('unavailable');
  });
  expect(screen.getByTestId('canPrompt')).toHaveTextContent('false');
});
