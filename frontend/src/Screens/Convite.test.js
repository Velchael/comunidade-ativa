import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import Convite from './Convite';
import { UserContext } from '../UserContext';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() }
    },
    get: jest.fn(),
    post: jest.fn(),
    request: jest.fn()
  }
}));

let mockPwaInstallState;

jest.mock('../PwaInstallContext', () => ({
  usePwaInstall: () => mockPwaInstallState
}));

const defaultPwaInstallState = () => ({
  isInstalled: false,
  isManualInstall: false,
  isPrompting: false,
  isDismissed: false,
  canPrompt: false,
  promptInstall: jest.fn().mockResolvedValue({ outcome: 'unavailable', platform: 'web' })
});

const validationResponse = {
  valid: true,
  comunidad: {
    id: 12,
    nombre: 'Comunidade Ativa'
  }
};

const renderConvite = ({
  pwaInstallState = {},
  acceptResponse = { accepted: true },
  refreshAuthSession = jest.fn().mockResolvedValue({ id: 7, comunidad_id: 12 }),
  userContext = {}
} = {}) => {
  axios.get.mockResolvedValue({ data: validationResponse });
  axios.post.mockResolvedValue({ data: acceptResponse });

  const promptInstall = pwaInstallState.promptInstall || jest.fn().mockResolvedValue({
    outcome: 'accepted',
    platform: 'web'
  });

  mockPwaInstallState = {
    ...defaultPwaInstallState(),
    ...pwaInstallState,
    promptInstall
  };

  const userContextValue = {
    user: { id: 7, email: 'membro@example.test' },
    token: 'auth-token',
    isHydrating: false,
    refreshAuthSession,
    ...userContext
  };

  const view = render(
    <HelmetProvider>
      <UserContext.Provider value={userContextValue}>
        <MemoryRouter initialEntries={['/convite/invite-token']}>
          <Routes>
            <Route path="/convite/:token" element={<Convite />} />
            <Route path="/interacciones" element={<div>Interacciones route</div>} />
            <Route path="/Seinscrever" element={<div>Login route</div>} />
          </Routes>
        </MemoryRouter>
      </UserContext.Provider>
    </HelmetProvider>
  );

  const rerenderWithPwa = (nextPwaInstallState) => {
    mockPwaInstallState = {
      ...mockPwaInstallState,
      ...nextPwaInstallState
    };

    view.rerender(
      <HelmetProvider>
        <UserContext.Provider value={userContextValue}>
          <MemoryRouter initialEntries={['/convite/invite-token']}>
            <Routes>
              <Route path="/convite/:token" element={<Convite />} />
              <Route path="/interacciones" element={<div>Interacciones route</div>} />
              <Route path="/Seinscrever" element={<div>Login route</div>} />
            </Routes>
          </MemoryRouter>
        </UserContext.Provider>
      </HelmetProvider>
    );
  };

  return {
    ...view,
    promptInstall,
    refreshAuthSession,
    rerenderWithPwa
  };
};

const acceptInvitation = async (expectedHeading = 'Tudo certo!') => {
  const enterButton = await screen.findByRole('button', { name: 'Entrar na comunidade' });
  await userEvent.click(enterButton);
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
  await screen.findByRole('heading', { name: expectedHeading });
};

beforeEach(() => {
  axios.get.mockReset();
  axios.post.mockReset();
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      requestPermission: jest.fn()
    }
  });
});

test('new member normal mostra Entrar na comunidade após sucesso', async () => {
  renderConvite();

  await acceptInvitation();

  expect(await screen.findByRole('heading', { name: 'Tudo certo!' })).toBeInTheDocument();
  expect(screen.getByText('Você agora faz parte de Comunidade Ativa.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Entrar na comunidade' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Ir para a comunidade' })).not.toBeInTheDocument();
});

test('installable mostra ação secundária Instalar COMUVA junto da entrada', async () => {
  renderConvite({ pwaInstallState: { canPrompt: true } });

  await acceptInvitation();

  expect(await screen.findByRole('button', { name: 'Entrar na comunidade' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Instalar COMUVA' })).toBeEnabled();
});

test('click em Instalar COMUVA chama promptInstall exatamente uma vez', async () => {
  const { promptInstall } = renderConvite({ pwaInstallState: { canPrompt: true } });

  await acceptInvitation();
  await userEvent.click(await screen.findByRole('button', { name: 'Instalar COMUVA' }));

  expect(promptInstall).toHaveBeenCalledTimes(1);
});

test('prompting mostra Instalando desabilitado e entrada continua habilitada', async () => {
  renderConvite({ pwaInstallState: { isPrompting: true } });

  await acceptInvitation();

  expect(await screen.findByRole('button', { name: 'Entrar na comunidade' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Instalando...' })).toBeDisabled();
});

test('installed oculta CTA de instalação e mantém entrada', async () => {
  renderConvite({ pwaInstallState: { isInstalled: true, canPrompt: true } });

  await acceptInvitation();

  expect(await screen.findByRole('button', { name: 'Entrar na comunidade' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Instalar COMUVA' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Como instalar COMUVA' })).not.toBeInTheDocument();
});

test('manual iOS mostra Como instalar COMUVA junto da entrada', async () => {
  renderConvite({ pwaInstallState: { isManualInstall: true } });

  await acceptInvitation();

  expect(await screen.findByRole('button', { name: 'Entrar na comunidade' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Como instalar COMUVA' })).toHaveAttribute('aria-expanded', 'false');
});

test('ajuda iOS alterna painel com instruções acessíveis', async () => {
  renderConvite({ pwaInstallState: { isManualInstall: true } });

  await acceptInvitation();
  const helpButton = await screen.findByRole('button', { name: 'Como instalar COMUVA' });
  await userEvent.click(helpButton);

  expect(helpButton).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('region', { name: 'Instruções para instalar COMUVA' })).toBeInTheDocument();
  expect(screen.getByText('Toque em Compartilhar.')).toBeInTheDocument();
  expect(screen.getByText('Escolha "Adicionar à Tela de Início".')).toBeInTheDocument();
  expect(screen.getByText('Confirme "Adicionar".')).toBeInTheDocument();
});

test('dismissed oculta instalação sem aviso e mantém entrada', async () => {
  renderConvite({ pwaInstallState: { isDismissed: true, canPrompt: true } });

  await acceptInvitation();

  expect(await screen.findByRole('button', { name: 'Entrar na comunidade' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Instalar COMUVA' })).not.toBeInTheDocument();
  expect(screen.queryByText(/não compatível|não suporta PWA|não pode instalar/i)).not.toBeInTheDocument();
});

test('unavailable mantém só o fluxo normal sem mensagem falsa', async () => {
  renderConvite();

  await acceptInvitation();

  expect(await screen.findByRole('button', { name: 'Entrar na comunidade' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Instalar COMUVA' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Como instalar COMUVA' })).not.toBeInTheDocument();
  expect(screen.queryByText(/não compatível|não suporta PWA|não pode instalar/i)).not.toBeInTheDocument();
});

test('Entrar na comunidade navega exatamente para interacciones', async () => {
  renderConvite({ pwaInstallState: { canPrompt: true } });

  await acceptInvitation();
  await userEvent.click(await screen.findByRole('button', { name: 'Entrar na comunidade' }));

  expect(await screen.findByText('Interacciones route')).toBeInTheDocument();
});

test('click instalar não solicita permissão de notificação', async () => {
  const { promptInstall } = renderConvite({ pwaInstallState: { canPrompt: true } });

  await acceptInvitation();
  await userEvent.click(await screen.findByRole('button', { name: 'Instalar COMUVA' }));

  expect(promptInstall).toHaveBeenCalledTimes(1);
  expect(window.Notification.requestPermission).not.toHaveBeenCalled();
});

test('already member mantém texto de sucesso próprio, entrada e não oferece PWA', async () => {
  renderConvite({
    acceptResponse: { accepted: true, already_member: true },
    pwaInstallState: { canPrompt: true, isManualInstall: true }
  });

  await acceptInvitation('Você já faz parte desta comunidade.');

  expect(await screen.findByRole('heading', { name: 'Você já faz parte desta comunidade.' })).toBeInTheDocument();
  expect(screen.getByText('Nenhuma alteração foi necessária.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Entrar na comunidade' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Ir para a comunidade' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Instalar COMUVA' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Como instalar COMUVA' })).not.toBeInTheDocument();
});

test('refresh failure não mostra PWA e mantém retry/login atual', async () => {
  renderConvite({
    pwaInstallState: { canPrompt: true, isManualInstall: true },
    refreshAuthSession: jest.fn().mockRejectedValue(new Error('refresh failed'))
  });

  await acceptInvitation();

  expect(await screen.findByRole('heading', { name: 'Tudo certo!' })).toBeInTheDocument();
  expect(screen.getByText('Sua entrada foi confirmada, mas não foi possível atualizar sua sessão agora.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tentar atualizar sessão' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Entrar na comunidade' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Instalar COMUVA' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Como instalar COMUVA' })).not.toBeInTheDocument();
});

test('refreshing não mostra PWA durante atualização posterior', async () => {
  renderConvite({
    pwaInstallState: { canPrompt: true },
    refreshAuthSession: jest.fn(() => new Promise(() => {}))
  });

  await acceptInvitation('Atualizando sua sessão...');

  expect(screen.getByRole('heading', { name: 'Atualizando sua sessão...' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Instalar COMUVA' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Como instalar COMUVA' })).not.toBeInTheDocument();
});

test('após estado installed, CTA instalação desaparece e entrada permanece', async () => {
  const { rerenderWithPwa } = renderConvite({ pwaInstallState: { canPrompt: true } });

  await acceptInvitation();
  expect(await screen.findByRole('button', { name: 'Instalar COMUVA' })).toBeInTheDocument();

  rerenderWithPwa({
    isInstalled: true,
    canPrompt: false,
    isPrompting: false
  });

  expect(await screen.findByRole('button', { name: 'Entrar na comunidade' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Instalar COMUVA' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Como instalar COMUVA' })).not.toBeInTheDocument();
  expect(screen.queryByText('Interacciones route')).not.toBeInTheDocument();
});
