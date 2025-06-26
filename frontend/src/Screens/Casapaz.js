import React from 'react';
import { NavLink,Outlet } from 'react-router-dom';
import { Navbar, Nav } from 'react-bootstrap';
//import Fidelidade from '../components/Fidelidade'; // Importa el componente Fidelidade
//import Redecao from '../components/Redecao';
const Casapaz = () => {
  return (
    <div>
      <section>
        <div className="imgservicodois">
          <h1 className="imgservico"> Casa de Paz </h1>
          <div>
          <img className="img-fluid rounded" src="/img/casapazintro.jpg" alt="Fidelidade" />
          </div>
      <h5>Como ter uma Casa de Paz! 🏠</h5>
          <p>
            Eu lhes deixo um presente, a minha plena paz. E essa paz que eu lhes dou é um presente que o mundo não pode dar. Portanto, não se aflijam nem tenham medo.
            João 14:27
          </p>
          <p>
            O Senhor Jesus Cristo falou da Paz plena, como um grande presente, que só ele pode dar e não o mundo.
          </p>
          <p>
            Esse dom da Paz plena surge quando reconhecemos e aceitamos o sacrifício de Jesus Cristo naquela cruz por nós.
          </p>
          <p>
            Através deste aplicativo aprenderemos sobre o sacrifício de Jesus, que é a única forma de ter o dom da Paz.
          </p>
        </div>
        <div className="imgservicodois">
          <h1 className="imgservico"> Proteção pelo sangue de Jesus</h1>
          <div>
          <img className="img-fluid rounded" src="/img/proteccion.webp" alt="Fidelidade" />
          </div>
          <p>
            O sangue será um sinal para indicar as casas em que vocês estiverem; quando eu vir o sangue, passarei adiante. A praga de destruição não os atingirá quando eu ferir o Egito. 
            Êxodo 12:13
          </p>
          <p>
            Se o sangue de um animal (cordeiro) salvou a casa dos filhos de Deus no antigo Testamento, quanto mais o sangue do Cordeiro de Deus, Jesus Cristo, salvará e dará paz à nossa casa hoje.
          </p>
          <p>
            O Senhor Jesus Cristo derramou sete vezes seu sangue tal qual no antiguo testamento fazia o sumo sacerdote pelo resgate dos pecados do povo. Levitico 14:7
          </p>
        </div>
      </section>
      <div className="imgservicodois">
      <Navbar bg="dark" variant="dark" expand="lg" collapseOnSelect style={{ backgroundColor: '#ca932b' }}>
        <Navbar.Brand className="mx-auto">
          7 derramamento do Sangue de Jesus
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="mr-auto">
            <Nav.Link as={NavLink} to="/Casapaz/Fidelidade">Fidelidade</Nav.Link>
            <Nav.Link as={NavLink} to="/Casapaz/Redecao">Redenção</Nav.Link>
            <Nav.Link as={NavLink} to="/Casapaz/Conquista">Conquista</Nav.Link>
            <Nav.Link as={NavLink} to="/Casapaz/Identidad">Identidad</Nav.Link>
            <Nav.Link as={NavLink} to="/Casapaz/Productividade">Productividade</Nav.Link>
            <Nav.Link as={NavLink} to="/Casapaz/Proposito">Proposito</Nav.Link>
            <Nav.Link as={NavLink} to="/Casapaz/Consagracao">Consagração</Nav.Link>
          </Nav>
        </Navbar.Collapse>
        
      </Navbar>
      
      </div>
      <Outlet />
    </div>
  );
};
export default Casapaz;