import React from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

export default function Casapaz() {
  const navigate = useNavigate();

  return (
    <div>

      {/* HERO SECTION */}
      <div
        style={{
          padding: "90px 20px",
          textAlign: "center"
        }}
      >
        <h1
          style={{
            fontSize: "52px",
            fontWeight: "bold",
            marginBottom: "20px",
            color: "#2c2c2c"
          }}
        >
          Nenhuma comunidade sobrevive sozinha.
        </h1>

        <p
          style={{
            fontSize: "22px",
            maxWidth: "850px",
            margin: "0 auto",
            color: "#555",
            lineHeight: "1.8"
          }}
        >
          A COMUVA conecta pessoas que precisam de ajuda
          com pessoas que podem ajudar.
          Uma plataforma humana baseada em cooperação,
          comunidade ativa e interdependência social.
        </p>

        <div style={{ marginTop: "40px" }}>
          <Button
            variant="warning"
            size="lg"
            style={{
              marginRight: "15px",
              padding: "12px 30px",
              fontWeight: "bold"
            }}
            onClick={() => navigate("/Seinscrever")}
          >
            Entrar com Google
          </Button>

          <Button
            variant="outline-dark"
            size="lg"
            style={{
              padding: "12px 30px",
              fontWeight: "bold"
            }}
            onClick={() => navigate("/Seinscrever")}
          >
            Criar conta
          </Button>
        </div>
      </div>

      {/* SEÇÃO FILOSOFIA */}
      <Container style={{ marginTop: "80px" }}>
        <Row className="justify-content-center">
          <Col md={10}>
            <Card
              style={{
                border: "none",
                borderRadius: "20px",
                padding: "40px",
                background: "#fffaf0",
                boxShadow: "0 0 20px rgba(0,0,0,0.08)"
              }}
            >
              <h2
                style={{
                  marginBottom: "25px",
                  fontWeight: "bold",
                  textAlign: "center"
                }}
              >
                O que é a COMUVA?
              </h2>

              <p
                style={{
                  fontSize: "20px",
                  lineHeight: "2",
                  color: "#444",
                  textAlign: "center"
                }}
              >
                Nas antigas civilizações,
                viver em comunidade era sobreviver.
                <br /><br />

                Ajudar não era opcional.
                Compartilhar fortalecia todos.
                <br /><br />

                A COMUVA resgata essa essência
                utilizando tecnologia humana e prática
                para fortalecer a cooperação real
                entre pessoas e comunidades.
                  <br /><br />

<p>
  Hoje:
</p>

<p>
  muitas pessoas vivem conectadas digitalmente…
  mas isoladas socialmente.
</p>

<p>
  A COMUVA nasce para recuperar:
</p>

<p>
  ✅ ajuda mútua <br />
  ✅ comunidade ativa <br />
  ✅ cooperação real <br />
  ✅ relações humanas autênticas
</p>  
              </p>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* COMO FUNCIONA */}
      <Container style={{ marginTop: "100px" }}>
        <h2
          style={{
            textAlign: "center",
            marginBottom: "50px",
            fontWeight: "bold"
          }}
        >
          Como funciona?
        </h2>

        <Row>

          {/* PASSO 1 */}
          <Col md={4}>
            <Card
              style={{
                textAlign: "center",
                padding: "30px",
                borderRadius: "20px",
                border: "none",
                boxShadow: "0 0 15px rgba(0,0,0,0.08)",
                minHeight: "280px"
              }}
            >
              <div style={{ fontSize: "55px" }}>🆘</div>

              <h4 style={{ marginTop: "20px" }}>
                Publique uma necessidade
              </h4>

              <p style={{ marginTop: "15px", color: "#666" }}>
                “Preciso de alimentos”
                <br />
                “Procuro cuidadora”
                <br />
                “Preciso de transporte”
              </p>
            </Card>
          </Col>

          {/* PASSO 2 */}
          <Col md={4}>
            <Card
              style={{
                textAlign: "center",
                padding: "30px",
                borderRadius: "20px",
                border: "none",
                boxShadow: "0 0 15px rgba(0,0,0,0.08)",
                minHeight: "280px"
              }}
            >
              <div style={{ fontSize: "55px" }}>🤝</div>

              <h4 style={{ marginTop: "20px" }}>
                Receba ajuda
              </h4>

              <p style={{ marginTop: "15px", color: "#666" }}>
                Pessoas reais respondem,
                colaboram e participam
                ativamente da comunidade.
              </p>
            </Card>
          </Col>

          {/* PASSO 3 */}
          <Col md={4}>
            <Card
              style={{
                textAlign: "center",
                padding: "30px",
                borderRadius: "20px",
                border: "none",
                boxShadow: "0 0 15px rgba(0,0,0,0.08)",
                minHeight: "280px"
              }}
            >
              <div style={{ fontSize: "55px" }}>🌱</div>

              <h4 style={{ marginTop: "20px" }}>
                Comunidade viva
              </h4>

              <p style={{ marginTop: "15px", color: "#666" }}>
                Cada interação fortalece
                o tecido social e a ajuda mútua.
              </p>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* EXEMPLOS REAIS */}
      <Container style={{ marginTop: "100px" }}>
        <h2
          style={{
            textAlign: "center",
            marginBottom: "50px",
            fontWeight: "bold"
          }}
        >
          Interações reais
        </h2>

        <Row>

          <Col md={6}>
            <Card
              style={{
                marginBottom: "20px",
                borderRadius: "20px",
                border: "none",
                padding: "25px",
                background: "#fff5f5"
              }}
            >
              <h5>🆘 Necessidade</h5>

              <p>
                “Preciso de uma cuidadora para minha mãe.”
              </p>

              <hr />

              <h5>🤝 Resposta</h5>

              <p>
                “Sou cuidadora e posso ajudar.”
              </p>
            </Card>
          </Col>

          <Col md={6}>
            <Card
              style={{
                marginBottom: "20px",
                borderRadius: "20px",
                border: "none",
                padding: "25px",
                background: "#f0fff4"
              }}
            >
              <h5>🆘 Necessidade</h5>

              <p>
                “Preciso de apoio psicológico para adolescente.”
              </p>

              <hr />

              <h5>🤝 Resposta</h5>

              <p>
                “Sou psicóloga e quero ajudar.”
              </p>
            </Card>
          </Col>

        </Row>
      </Container>

      {/* TESTEMUNHOS */}
      <Container style={{ marginTop: "100px", marginBottom: "100px" }}>
        <h2
          style={{
            textAlign: "center",
            marginBottom: "50px",
            fontWeight: "bold"
          }}
        >
          Depoimentos
        </h2>

        <Row>

          <Col md={4}>
            <Card
              style={{
                padding: "25px",
                borderRadius: "20px",
                border: "none",
                height: "100%"
              }}
            >
              <p>
                “Graças à COMUVA encontrei ajuda
                quando mais precisava.”
              </p>

              <strong>— Maria</strong>
            </Card>
          </Col>

          <Col md={4}>
            <Card
              style={{
                padding: "25px",
                borderRadius: "20px",
                border: "none",
                height: "100%"
              }}
            >
              <p>
                “O aplicativo voltou a conectar
                nossa comunidade.”
              </p>

              <strong>— Carlos</strong>
            </Card>
          </Col>

          <Col md={4}>
            <Card
              style={{
                padding: "25px",
                borderRadius: "20px",
                border: "none",
                height: "100%"
              }}
            >
              <p>
                “Encontrei pessoas reais
                dispostas a ajudar.”
              </p>

              <strong>— Joana</strong>
            </Card>
          </Col>

        </Row>
      </Container>

    </div>
  );
}