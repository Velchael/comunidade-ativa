import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { UserContext } from '../UserContext';

let mockPwaInstallState;

jest.mock('../UserContext', () => {
  const React = require('react');
  return {
    UserContext: React.createContext()
  };
});

jest.mock('../PwaInstallContext', () => ({
  usePwaInstall: () => mockPwaInstallState
}));

const defaultUser = {
  id: 7,
  email: 'membro@example.test',
  username: 'Membro Teste'
};

const defaultPwaInstallState = () => ({
  isInstalled: false,
  isManualInstall: false,
  isPrompting: false,
  isDismissed: false,
  canPrompt: false,
  promptInstall: jest.fn().mockResolvedValue({ outcome: 'unavailable', platform: 'web' })
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
}

const renderSidebar = ({
  isOpen = true,
  user = defaultUser,
  isHydrating = false,
  logout = jest.fn(),
  toggle = jest.fn(),
  pwaInstallState = {}
} = {}) => {
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
    user,
    isHydrating,
    logout
  };

  const view = render(
    <UserContext.Provider value={userContextValue}>
      <MemoryRouter initialEntries={['/current']}>
        <Sidebar isOpen={isOpen} toggle={toggle} />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </UserContext.Provider>
  );

  return {
    ...view,
    logout,
    promptInstall,
    toggle
  };
};

beforeEach(() => {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      requestPermission: jest.fn()
    }
  });
});

test('canPrompt mostra Instalar COMUVA para usuário autenticado', () => {
  renderSidebar({ pwaInstallState: { canPrompt: true } });

  expect(screen.getByRole('button', { name: 'Instalar COMUVA' })).toBeEnabled();
});

test('click em Instalar COMUVA chama promptInstall exatamente uma vez sem fechar menu nem pedir notificação', async () => {
  const { promptInstall, toggle } = renderSidebar({ pwaInstallState: { canPrompt: true } });

  await userEvent.click(screen.getByRole('button', { name: 'Instalar COMUVA' }));

  expect(promptInstall).toHaveBeenCalledTimes(1);
  expect(toggle).not.toHaveBeenCalled();
  expect(window.Notification.requestPermission).not.toHaveBeenCalled();
});

test('prompting mostra Instalando desabilitado', () => {
  renderSidebar({ pwaInstallState: { isPrompting: true } });

  expect(screen.getByRole('button', { name: 'Instalando...' })).toBeDisabled();
});

test('installed oculta opções de instalação', () => {
  renderSidebar({ pwaInstallState: { isInstalled: true, canPrompt: true, isManualInstall: true } });

  expect(screen.queryByRole('button', { name: /Instalar COMUVA/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Como instalar COMUVA/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/COMUVA instalada/i)).not.toBeInTheDocument();
});

test('dismissed oculta opções de instalação', () => {
  renderSidebar({ pwaInstallState: { isDismissed: true, canPrompt: true, isManualInstall: true } });

  expect(screen.queryByRole('button', { name: /Instalar COMUVA/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Como instalar COMUVA/ })).not.toBeInTheDocument();
});

test('unavailable oculta opções de instalação sem aviso falso', () => {
  renderSidebar();

  expect(screen.queryByRole('button', { name: /Instalar COMUVA/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Como instalar COMUVA/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/não compatível|não suporta PWA|não pode instalar/i)).not.toBeInTheDocument();
});

test('manual iOS mostra Como instalar COMUVA com atributos acessíveis', () => {
  renderSidebar({ pwaInstallState: { isManualInstall: true } });

  const helpButton = screen.getByRole('button', { name: 'Como instalar COMUVA' });
  expect(helpButton).toHaveAttribute('aria-expanded', 'false');
  expect(helpButton).toHaveAttribute('aria-controls', 'sidebar-pwa-manual-help');
});

test('click manual mostra instruções iOS em região acessível', async () => {
  renderSidebar({ pwaInstallState: { isManualInstall: true } });

  const helpButton = screen.getByRole('button', { name: 'Como instalar COMUVA' });
  await userEvent.click(helpButton);

  expect(helpButton).toHaveAttribute('aria-expanded', 'true');
  const region = screen.getByRole('region', { name: 'Instruções para instalar COMUVA' });
  expect(region).toHaveAttribute('id', 'sidebar-pwa-manual-help');
  expect(within(region).getByText('Toque em Compartilhar.')).toBeInTheDocument();
  expect(within(region).getByText('Escolha "Adicionar à Tela de Início".')).toBeInTheDocument();
  expect(within(region).getByText('Confirme "Adicionar".')).toBeInTheDocument();
});

test('Sair aparece para autenticado depois dos elementos normais', () => {
  const { container } = renderSidebar({ pwaInstallState: { canPrompt: true } });

  expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();

  const sidebarText = container.querySelector('.sidebar').textContent;
  expect(sidebarText.indexOf('Meu Perfil')).toBeLessThan(sidebarText.indexOf('Agenda'));
  expect(sidebarText.indexOf('Agenda')).toBeLessThan(sidebarText.indexOf('Grupos'));
  expect(sidebarText.indexOf('Grupos')).toBeLessThan(sidebarText.indexOf('Conversas'));
  expect(sidebarText.indexOf('Conversas')).toBeLessThan(sidebarText.indexOf('Instalar COMUVA'));
  expect(sidebarText.indexOf('Instalar COMUVA')).toBeLessThan(sidebarText.indexOf('Sair'));
});

test('click em Sair reutiliza logout, fecha sidebar e navega para inicio', async () => {
  const { logout, toggle } = renderSidebar();

  await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

  expect(logout).toHaveBeenCalledTimes(1);
  expect(toggle).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('location-path')).toHaveTextContent('/');
});

test('NavLinks existentes seguem chamando toggle', async () => {
  const { toggle } = renderSidebar();

  await userEvent.click(screen.getByRole('link', { name: 'Agenda' }));
  await userEvent.click(screen.getByRole('link', { name: 'Grupos' }));
  await userEvent.click(screen.getByRole('link', { name: 'Conversas' }));
  await userEvent.click(screen.getByRole('link', { name: 'Meu Perfil' }));

  expect(toggle).toHaveBeenCalledTimes(4);
});

test('usuário não autenticado não vê instalação nem Sair', () => {
  renderSidebar({ user: null, pwaInstallState: { canPrompt: true, isManualInstall: true } });

  expect(screen.queryByRole('button', { name: /Instalar COMUVA/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Como instalar COMUVA/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Sair/ })).not.toBeInTheDocument();
});
