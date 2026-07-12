import React from "react";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const homeSections = [
  {
    eyebrow: "Interações",
    icon: "🤝",
    title: "Interações que aproximam pessoas",
    text:
      "Peça ajuda, ofereça apoio, responda e converse com pessoas da sua comunidade. Cada interação aproxima pessoas e transforma cuidado em ação.",
    image: "/home/interacoes-maos-unidas.jpg",
    alt: "Mãos unidas representando cooperação entre pessoas",
    reverse: false,
    tone: "interacoes"
  },
  {
    eyebrow: "Agenda",
    icon: "📅",
    title: "Agenda para colocar a comunidade em movimento",
    text:
      "Organize mutirões, encontros, tarefas e ações reais da comunidade. A Agenda ajuda a transformar intenção em presença, compromisso e movimento.",
    image: "/home/agenda-limpeza-comunitaria.jpg",
    alt: "Voluntários organizados em uma ação de limpeza comunitária",
    reverse: true,
    tone: "agenda"
  },
  {
    eyebrow: "Grupos por Comunidade",
    icon: "👥",
    title: "Grupos para servir melhor",
    text:
      "Crie e participe de grupos que atuam em necessidades locais: alimentos, transporte, limpeza, campanhas, visitas, apoio e outras formas de servir.",
    image: "/home/grupos-entrega-alimentos.jpg",
    alt: "Pessoas entregando alimento em uma ação comunitária",
    reverse: false,
    tone: "grupos"
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
            Pessoas ajudando pessoas. Fortalecendo comunidades através da
            cooperação, da solidariedade e da participação.
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
          <p className="comuva-kicker">O que é a COMUVA?</p>
          <h2 id="comuva-mission-title">
            Uma plataforma para fortalecer comunidades.
          </h2>
          <p>
            A COMUVA é uma plataforma para fortalecer comunidades por meio da
            ajuda mútua, da organização comunitária e da participação cidadã.
            Aqui, necessidades reais encontram pessoas dispostas a colaborar.
          </p>
        </div>
      </section>

      <section className="comuva-story" aria-label="Como a COMUVA funciona">
        {homeSections.map((section, index) => (
          <article
            className={`comuva-feature comuva-feature--${section.tone} ${
              section.reverse ? "comuva-feature--reverse" : ""
            }`}
            key={section.eyebrow}
          >
            <div className="comuva-feature__media">
              <img src={section.image} alt={section.alt} />
            </div>

            <div className="comuva-feature__content">
              <p className="comuva-feature__number">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="comuva-feature__eyebrow">
                <span aria-hidden="true">{section.icon}</span>
                {section.eyebrow}
              </p>
              <h2>{section.title}</h2>
              <p>{section.text}</p>
            </div>
          </article>
        ))}
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
            Quando pessoas caminham juntas, pequenos gestos transformam vidas e
            fortalecem toda a comunidade.
          </p>
        </div>
      </section>

      <section className="comuva-story" aria-label="Impacto humano da COMUVA">
        <article className="comuva-feature comuva-feature--solidariedade comuva-feature--reverse">
          <div className="comuva-feature__media">
            <img
              src="/home/solidariedade-consolo.jpg"
              alt="Pessoa oferecendo consolo e apoio em um momento sensível"
            />
          </div>

          <div className="comuva-feature__content">
            <p className="comuva-feature__number">04</p>
            <p className="comuva-feature__eyebrow">
              <span aria-hidden="true">❤️</span>
              Histórias de solidariedade
            </p>
            <h2>A solidariedade começa nos pequenos gestos</h2>
            <p>
              A solidariedade começa nos pequenos gestos: escutar, responder,
              acompanhar e estar presente quando alguém precisa.
            </p>
          </div>
        </article>

        <article className="comuva-feature comuva-feature--crescimento">
          <div className="comuva-feature__media">
            <img
              src="/home/crescimento-sembrando.jpg"
              alt="Mãos plantando uma muda como símbolo de crescimento comunitário"
            />
          </div>

          <div className="comuva-feature__content">
            <p className="comuva-feature__number">05</p>
            <p className="comuva-feature__eyebrow">
              <span aria-hidden="true">🌱</span>
              Crescimento comunitário
            </p>
            <h2>Ajudar hoje fortalece a comunidade do amanhã</h2>
            <p>
              Ajudar hoje fortalece a comunidade do amanhã. Quando a cooperação
              vira hábito, a comunidade cresce com mais confiança, cuidado e
              pertencimento.
            </p>
          </div>
        </article>
      </section>

      <section className="comuva-final" aria-labelledby="comuva-final-title">
        <div className="comuva-section-inner comuva-section-inner--narrow">
          <h2 id="comuva-final-title">Faça parte da sua comunidade.</h2>
          <p>
            Entre, participe e ajude a manter sua comunidade viva, ativa e em
            movimento.
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
