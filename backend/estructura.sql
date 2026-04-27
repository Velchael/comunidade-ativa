--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Debian 14.18-1.pgdg120+1)
-- Dumped by pg_dump version 14.18 (Debian 14.18-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: enum_tasks_frequency; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_tasks_frequency AS ENUM (
    'semanal',
    'mensual',
    'anual'
);


ALTER TYPE public.enum_tasks_frequency OWNER TO postgres;

--
-- Name: enum_tasks_priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_tasks_priority AS ENUM (
    'baja',
    'media',
    'alta'
);


ALTER TYPE public.enum_tasks_priority OWNER TO postgres;

--
-- Name: enum_tasks_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_tasks_status AS ENUM (
    'pendiente',
    'en_progreso',
    'completada',
    'cancelada'
);


ALTER TYPE public.enum_tasks_status OWNER TO postgres;

--
-- Name: enum_users_rol; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_users_rol AS ENUM (
    'admin_total',
    'admin_basic',
    'miembro'
);


ALTER TYPE public.enum_users_rol OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


ALTER TABLE public."SequelizeMeta" OWNER TO postgres;

--
-- Name: comunidades; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comunidades (
    id integer NOT NULL,
    nombre_comunidad character varying(255) NOT NULL,
    descripcion text,
    direccion character varying(255),
    telefono character varying(255),
    nombre_administrador character varying(255),
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.comunidades OWNER TO postgres;

--
-- Name: comunidades_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comunidades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.comunidades_id_seq OWNER TO postgres;

--
-- Name: comunidades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comunidades_id_seq OWNED BY public.comunidades.id;


--
-- Name: grupos_activos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grupos_activos (
    id integer NOT NULL,
    comunidad_id integer NOT NULL,
    lider_id integer NOT NULL,
    colider_id integer,
    anfitrion_id integer,
    direccion_grupo text NOT NULL,
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now()
);


ALTER TABLE public.grupos_activos OWNER TO postgres;

--
-- Name: grupos_activos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grupos_activos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.grupos_activos_id_seq OWNER TO postgres;

--
-- Name: grupos_activos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grupos_activos_id_seq OWNED BY public.grupos_activos.id;


--
-- Name: reportes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reportes (
    id integer NOT NULL,
    grupo_id integer NOT NULL,
    creador_id integer NOT NULL,
    semana timestamp with time zone NOT NULL,
    asistencia integer,
    tema character varying(255) NOT NULL,
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now(),
    fecha_actualizacion timestamp with time zone DEFAULT now()
);


ALTER TABLE public.reportes OWNER TO postgres;

--
-- Name: reportes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reportes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.reportes_id_seq OWNER TO postgres;

--
-- Name: reportes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reportes_id_seq OWNED BY public.reportes.id;


--
-- Name: reuniones_grupo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reuniones_grupo (
    id integer NOT NULL,
    grupo_id integer NOT NULL,
    fecha date NOT NULL,
    tema_compartido text NOT NULL,
    asistentes_regulares integer DEFAULT 0,
    nuevos_asistentes integer DEFAULT 0,
    observaciones text,
    creado_por integer NOT NULL,
    creado_en timestamp with time zone DEFAULT now()
);


ALTER TABLE public.reuniones_grupo OWNER TO postgres;

--
-- Name: reuniones_grupo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reuniones_grupo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.reuniones_grupo_id_seq OWNER TO postgres;

--
-- Name: reuniones_grupo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reuniones_grupo_id_seq OWNED BY public.reuniones_grupo.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    frequency public.enum_tasks_frequency NOT NULL,
    created_by integer NOT NULL,
    comunidad_id integer NOT NULL,
    due_date date NOT NULL,
    status public.enum_tasks_status DEFAULT 'pendiente'::public.enum_tasks_status,
    priority public.enum_tasks_priority DEFAULT 'media'::public.enum_tasks_priority,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tasks_id_seq OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    googleid character varying(255),
    username character varying(255),
    apellido character varying(255),
    email character varying(255) NOT NULL,
    password character varying(255),
    rol public.enum_users_rol DEFAULT 'miembro'::public.enum_users_rol NOT NULL,
    fecha_nacimiento date,
    telefono character varying(255),
    direccion character varying(255),
    nivel_liderazgo character varying(255),
    grupo_familiar_id integer,
    estado character varying(255),
    foto_perfil character varying(255),
    confirmed boolean DEFAULT true NOT NULL,
    comunidad_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: comunidades id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comunidades ALTER COLUMN id SET DEFAULT nextval('public.comunidades_id_seq'::regclass);


--
-- Name: grupos_activos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos_activos ALTER COLUMN id SET DEFAULT nextval('public.grupos_activos_id_seq'::regclass);


--
-- Name: reportes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reportes ALTER COLUMN id SET DEFAULT nextval('public.reportes_id_seq'::regclass);


--
-- Name: reuniones_grupo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reuniones_grupo ALTER COLUMN id SET DEFAULT nextval('public.reuniones_grupo_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: comunidades comunidades_nombre_comunidad_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comunidades
    ADD CONSTRAINT comunidades_nombre_comunidad_key UNIQUE (nombre_comunidad);


--
-- Name: comunidades comunidades_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comunidades
    ADD CONSTRAINT comunidades_pkey PRIMARY KEY (id);


--
-- Name: grupos_activos grupos_activos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos_activos
    ADD CONSTRAINT grupos_activos_pkey PRIMARY KEY (id);


--
-- Name: reportes reportes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT reportes_pkey PRIMARY KEY (id);


--
-- Name: reuniones_grupo reuniones_grupo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reuniones_grupo
    ADD CONSTRAINT reuniones_grupo_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: reportes unique_reporte_semana; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT unique_reporte_semana UNIQUE (grupo_id, semana);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_googleid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_googleid_key UNIQUE (googleid);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: grupos_activos grupos_activos_anfitrion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos_activos
    ADD CONSTRAINT grupos_activos_anfitrion_id_fkey FOREIGN KEY (anfitrion_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: grupos_activos grupos_activos_colider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos_activos
    ADD CONSTRAINT grupos_activos_colider_id_fkey FOREIGN KEY (colider_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: grupos_activos grupos_activos_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos_activos
    ADD CONSTRAINT grupos_activos_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON DELETE CASCADE;


--
-- Name: grupos_activos grupos_activos_lider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos_activos
    ADD CONSTRAINT grupos_activos_lider_id_fkey FOREIGN KEY (lider_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reportes reportes_creador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT reportes_creador_id_fkey FOREIGN KEY (creador_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reportes reportes_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT reportes_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos_activos(id) ON DELETE CASCADE;


--
-- Name: reuniones_grupo reuniones_grupo_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reuniones_grupo
    ADD CONSTRAINT reuniones_grupo_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reuniones_grupo reuniones_grupo_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reuniones_grupo
    ADD CONSTRAINT reuniones_grupo_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos_activos(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_comunidad_id_fkey FOREIGN KEY (comunidad_id) REFERENCES public.comunidades(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

