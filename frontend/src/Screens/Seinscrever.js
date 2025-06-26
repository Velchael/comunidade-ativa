import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';//import Container from 'react-bootstrap/Container';
import { Container, Form, Button, Alert } from 'react-bootstrap';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { Helmet } from 'react-helmet-async';
import { UserContext } from '../UserContext';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

export default function SeInscrever() {
  const { setUser } = useContext(UserContext);

  const [isSignup, setIsSignup] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    apellido: '',
    email: '',
    password: '',
    rememberMe: false, // Añadir rememberMe
    rol: 'miembro',  // Valor por defecto para rol
    confirmPassword: '',
    fecha_nacimiento: '',
    telefono: '',
    direccion: '',
    nivel_liderazgo: 'Nivel1',
    grupo_familiar_id: '',
    estado: 'activo',
    foto_perfil: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  
const userExists = async (username, email, password) => {
  try {
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/api/users/login`,
      { username, email, password },
      { withCredentials: true }
    );
    return response.status === 200;
  } catch (error) {
    if (error.response?.status === 404) return false;
      // 🚨 Aquí lanza el error si es 500 u otro
    console.error('🚨 Erro crítico ao verificar o usuário:', error.message);
    throw new Error('Erro no servidor ao verificar usuário');
  }
};


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSignup) {
        if (formData.password !== formData.confirmPassword) {
            setMessage({ type: 'danger', text: 'As senhas não coincidem.' });
            return;
        }

        const exists = await userExists(formData.username, formData.email, formData.password);
        if (exists) {
            setMessage({ type: 'danger', text: 'O usuário já existe. Tente fazer login.' });
            return;
        }
    }
     // URL dinámica según si es login o signup
    const url = `${process.env.REACT_APP_API_URL}/api/users${isSignup ? '' : '/login'}`;
  
    try {
        const response = await axios.post(url, formData);
        console.log(formData);
        const data = response.data;

        if (response.status === 200) {
            setMessage({ type: 'success', 
                         text: isSignup 
                         ? 'Um e-mail chegará em sua conta de correio para concluir seu cadastro, confirme...'
                         : 'Usuário logado com sucesso!' 
                         });

            if (!isSignup) {
                if (formData.rememberMe) {
                    localStorage.setItem('token', data.token);
                } else {
                    sessionStorage.setItem('token', data.token);
                }
                const decodedToken = jwtDecode(data.token);
                const username = decodedToken.username || 'Usuario';
                setUser({ username });
            }
        } else if (response.status === 409) {
            setMessage({
                type: 'danger',
                text: 'O email já está registrado. Por favor, use outro email.',
            });
        } else if (response.status === 400 && data.message === 'Grupo familiar no encontrado') {
            setMessage({
                type: 'danger',
                text: 'El grupo familiar especificado no existe. Por favor, verifica e intenta novamente.',
            });
        } else {
            setMessage({
                type: 'danger',
                text: data.message || (isSignup ? 'Erro ao registrar o usuário.' : 'Usuário não existe.'),
            });
        }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        setMessage({ type: 'danger', text: 'Usuário não encontrado. Por favor, verifique suas credenciais.' });
      } else {
        console.error('Error al intentar conectarse al servidor:', error);
        // setMessage({ type: 'danger', text: 'Erro na rede. Tente novamente mais tarde.' });
      }
    }
};
  return (
    <Container className="small-container">
      <Helmet>
        <title>{isSignup ? 'Registro' : 'Login'}</title>
      </Helmet>
      <h1 className="my-3">{isSignup ? 'Registro' : 'Login'}</h1>
      <Form onSubmit={handleSubmit}>
        {message.text && (
          <Alert variant={message.type}>
            {message.text}
          </Alert>
        )}
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="username">
              <Form.Label>Nome</Form.Label>
              <Form.Control
                type="text"
                required
                placeholder="Digite seu nome"
                name="username"
                value={formData.username}
                onChange={handleChange}
                autoComplete="username"
              />
            </Form.Group>
          </Col>
          {isSignup && (
            <Col md={6}>
              <Form.Group className="mb-3" controlId="apellido">
                <Form.Label>Sobrenome</Form.Label>
                <Form.Control
                  type="text"
                  required
                  placeholder="Digite seu apellido"
                  name="apellido"
                  value={formData.apellido}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
          )}
        </Row>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="email">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                required
                placeholder="exemplo@gmail.com"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="password">
              <Form.Label>Senha</Form.Label>
              <Form.Control
                type="password"
                required
                placeholder="Digite sua senha"
                name="password"
                value={formData.password}
                onChange={handleChange}
              />
            </Form.Group>
          </Col>
        </Row>
        {isSignup && (
          <>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="confirmPassword">
                  <Form.Label>Confirme a Senha</Form.Label>
                  <Form.Control
                    type="password"
                    required
                    placeholder="Confirme sua senha"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="rol">
                  <Form.Label>Rol</Form.Label>
                  <Form.Control
                    as="select"
                    required
                    name="rol"
                    value={formData.rol}
                    onChange={handleChange}
                  >
                    <option value="miembro">Miembro</option>
                    <option value="lider">Líder</option>
                    <option value="pastor">Pastor</option>
                    <option value="administrador">Administrador</option>
                  </Form.Control>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="fecha_nacimiento">
                  <Form.Label>Data de nascimento</Form.Label>
                  <Form.Control
                    type="date"
                    required
                    name="fecha_nacimiento"
                    value={formData.fecha_nacimiento}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="telefono">
                  <Form.Label>Teléfone</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    name="telefono"
                    placeholder="Digite seu teléfono"
                    value={formData.telefono}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="direccion">
                  <Form.Label>Endereço</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    name="direccion"
                    placeholder="Digite sua dirección"
                    value={formData.direccion}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="nivel_liderazgo">
                  <Form.Label>Nível de liderança</Form.Label>
                  <Form.Control
                    as="select"
                    name="nivel_liderazgo"
                    value={formData.nivel_liderazgo}
                    onChange={handleChange}
                  >
                    <option value="Nivel1">Nivel 1</option>
                    <option value="Nivel2">Nivel 2</option>
                    <option value="Nivel3">Nivel 3</option>
                  </Form.Control>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="grupo_familiar_id">
                  <Form.Label>Grupo Familiar ID</Form.Label>
                  <Form.Control
                    type="number"
                    name="grupo_familiar_id"
                    value={formData.grupo_familiar_id}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="estado">
                  <Form.Label>Estado</Form.Label>
                  <Form.Control
                    as="select"
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="pendiente">Pendiente</option>
                  </Form.Control>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3" controlId="foto_perfil">
                  <Form.Label>Imagem de perfil</Form.Label>
                  <Form.Control
                    type="text"
                    name="foto_perfil"
                    placeholder="URL da imagem de perfil"
                    value={formData.foto_perfil}
                    onChange={handleChange}
                    >
                   </Form.Control>
                </Form.Group>
              </Col>
            </Row>
          </>
        )}
        {!isSignup && (
         <Form.Group className="mb-3" controlId="rememberMe">
          <Form.Check 
            type="checkbox" 
            label="Mantener sesión iniciada" 
            name="rememberMe"
            checked={formData.rememberMe} 
            onChange={handleChange} 
          />
         </Form.Group>
         )}
        <div className="mb-3">
          <Button type="submit">{isSignup ? 'Registrar' : 'Entrar'}</Button>
        </div>
        <div className="mb-3">
          {isSignup ? (
            <span>
              Já tem uma conta?{' '}
              <Link to="#" onClick={() => setIsSignup(false)}>Entrar</Link>
            </span>
          ) : (
            <span>
              Novo usuário?{' '}
              <Link to="#" onClick={() => setIsSignup(true)}>Crie sua conta</Link>
            </span>
          )}
        </div>
      </Form>
    </Container>
  );
}
