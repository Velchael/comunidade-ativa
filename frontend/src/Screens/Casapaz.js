import React from "react";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const communityTools = [
  {
    eyebrow: "Interações",
    icon: "🤝",
    title: "Conversas que viram cuidado",
    text:
      "Pedidos, respostas e iniciativas ficam visíveis para que mais pessoas possam participar."
  },
  {
    eyebrow: "Agenda",
    icon: "📅",
    title: "Atividades com presença real",
    text:
      "Encontros, mutirões, tarefas e ações comunitárias ganham organização simples."
  },
  {
    eyebrow: "Grupos",
    icon: "👥",
    title: "Pessoas reunidas por propósito",
    text:
      "Equipes, frentes de apoio e projetos podem se organizar sem perder o vínculo com a comunidade."
  },
  {
    eyebrow: "Membros",
    icon: "🧭",
    title: "Participação mais clara",
    text:
      "A comunidade entende quem faz parte, quem pode ajudar e onde cada pessoa pode contribuir."
  },
  {
    eyebrow: "Notificações",
    icon: "🔔",
    title: "Comunicação que aproxima",
    text:
      "Avisos importantes chegam com clareza para manter todos conectados ao que está acontecendo."
  }
];

export default function Casapaz() {
  const navigate = useNavigate();
  const goToSignup = () => navigate("/Seinscrever");

  return (
    <div className="comuva-home">
      <section className="comuva-hero" aria-labelledby="comuva-hero-title">
        <div className="comuva-hero__image-wrap">
          <img
            className="comuva-hero__image"
            src="/home/hero-inclusion.jpg"
            alt="Grupo diverso recebendo uma pessoa com acolhimento e confiança"
          />
        </div>

        <div className="comuva-hero__content">
          <p className="comuva-kicker">Comunidade ativa</p>
          <h1 id="comuva-hero-title">Bem-vindo à COMUVA</h1>
          <p className="comuva-hero__subtitle">
            Comunidade Viva, Ativa e em Movimento.
          </p>
          <p className="comuva-hero__text">
            Pessoas ajudando pessoas. Comunidades que participam, cooperam e
            crescem juntas através de vínculos reais.
          </p>

          <div className="comuva-actions" aria-label="Ações principais">
            <Button
              className="comuva-button comuva-button--primary"
              size="lg"
              onClick={goToSignup}
            >
              Entrar na COMUVA
            </Button>

            <Button
              className="comuva-button comuva-button--secondary"
              size="lg"
              variant="outline-dark"
              onClick={goToSignup}
            >
              Criar conta
            </Button>
          </div>
        </div>
      </section>

      <section className="comuva-mission" aria-labelledby="comuva-mission-title">
        <div className="comuva-section-inner comuva-section-inner--narrow">
          <p className="comuva-kicker">Comunidade em movimento</p>
          <h2 id="comuva-mission-title">
            Uma comunidade não ganha vida só porque as pessoas estão reunidas.
          </h2>
          <p>
            Ela ganha vida quando pessoas se reconhecem, participam, cooperam,
            se ajudam e crescem juntas. A COMUVA existe para tornar essa vida
            comunitária mais visível, simples e acessível no dia a dia.
          </p>
        </div>
      </section>

      <section
        className="comuva-emotional"
        aria-labelledby="comuva-emotional-title"
      >
        <div className="comuva-section-inner comuva-section-inner--narrow">
          <p className="comuva-kicker">Filosofia COMUVA</p>
          <h2 id="comuva-emotional-title">
            Nenhuma comunidade sobrevive sozinha.
          </h2>
          <p>
            Quando pessoas caminham juntas, pequenos gestos viram apoio,
            fortalecem vidas e fazem a comunidade permanecer viva, ativa e em
            movimento.
          </p>
        </div>
      </section>

      <section className="comuva-story" aria-label="Fortalecimento comunitário com COMUVA">
        <article className="comuva-feature comuva-feature--solidariedade comuva-feature--reverse">
          <div className="comuva-feature__media">
            <img
              src="/home/solidariedade-consolo.jpg"
              alt="Pessoa oferecendo apoio e presença a outra pessoa"
            />
          </div>

          <div className="comuva-feature__content">
            <p className="comuva-feature__number">01</p>
            <p className="comuva-feature__eyebrow">
              <span aria-hidden="true">❤️</span>
              Ajuda mútua
            </p>
            <h2>A solidariedade começa quando alguém percebe uma necessidade</h2>
            <p>
              Escutar, responder, acompanhar, oferecer tempo, dividir uma tarefa
              ou mobilizar um grupo. A COMUVA ajuda esses pequenos gestos a
              encontrarem caminho dentro da comunidade.
            </p>
          </div>
        </article>
      </section>

      <section className="comuva-toolkit" aria-labelledby="comuva-toolkit-title">
        <div className="comuva-section-inner">
          <div className="comuva-toolkit__intro">
            <p className="comuva-kicker">Um espaço simples para participar</p>
            <h2 id="comuva-toolkit-title">
              Organização, conexão e comunicação a serviço da vida comunitária.
            </h2>
            <p>
              A COMUVA transforma necessidades, iniciativas, atividades e
              conversas em participação real, sem complicar a rotina de quem
              organiza nem de quem participa.
            </p>
          </div>

          <div className="comuva-tools-grid" aria-label="Ferramentas da COMUVA">
            {communityTools.map((tool) => (
              <article className="comuva-tool-card" key={tool.eyebrow}>
                <span className="comuva-tool-card__icon" aria-hidden="true">
                  {tool.icon}
                </span>
                <p className="comuva-feature__eyebrow">{tool.eyebrow}</p>
                <h3>{tool.title}</h3>
                <p>{tool.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="comuva-story" aria-label="Crescimento comunitário">
        <article className="comuva-feature comuva-feature--crescimento">
          <div className="comuva-feature__media">
            <img
              src="/home/crescimento-sembrando.jpg"
              alt="Mãos cuidando de uma muda como símbolo de crescimento comunitário"
            />
          </div>

          <div className="comuva-feature__content">
            <p className="comuva-feature__number">02</p>
            <p className="comuva-feature__eyebrow">
              <span aria-hidden="true">🌱</span>
              Crescimento comunitário
            </p>
            <h2>Quando a participação vira hábito, a comunidade cresce</h2>
            <p>
              Com mais organização e interação, cada pessoa entende onde pode
              contribuir. Assim, a comunidade cresce com mais confiança,
              pertencimento e cuidado compartilhado.
            </p>
          </div>
        </article>
      </section>

      <section className="comuva-platform" aria-labelledby="comuva-platform-title">
        <div className="comuva-section-inner comuva-section-inner--narrow">
          <p className="comuva-kicker">COMUVA na prática</p>
          <h2 id="comuva-platform-title">
            Uma plataforma digital para organizar, conectar e fortalecer comunidades reais.
          </h2>
          <p>
            Organize membros, atividades, grupos, interações e comunicações em
            um ambiente simples, humano e acessível pelo celular.
          </p>
        </div>
      </section>

      <section className="comuva-final" aria-labelledby="comuva-final-title">
        <div className="comuva-section-inner comuva-section-inner--narrow">
          <h2 id="comuva-final-title">Faça parte da sua comunidade.</h2>
          <p>
            Entre, participe, convide pessoas a colaborar e ajude a manter sua
            comunidade viva, ativa e em movimento.
          </p>

          <Button
            className="comuva-button comuva-button--primary"
            size="lg"
            onClick={goToSignup}
          >
            Começar agora
          </Button>

          <div className="comuva-signature" aria-label="Frase institucional">
            <strong>COMUVA</strong>
            <span>Comunidade Viva, Ativa e em Movimento.</span>
            <span>Porque nenhuma comunidade sobrevive sozinha.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
