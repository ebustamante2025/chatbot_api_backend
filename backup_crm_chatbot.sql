--
-- PostgreSQL database dump
--

\restrict b31sxJparRfoQinOZcC3KYraVlWAgd1d8uhtBCpGKhR710S2yaMrsdOT0NXtPJH

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: adjuntos; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.adjuntos (
    id_adjunto bigint NOT NULL,
    empresa_id bigint NOT NULL,
    conversacion_id bigint NOT NULL,
    mensaje_id bigint,
    subido_por_tipo character varying(20) NOT NULL,
    subido_por_usuario_id bigint,
    subido_por_contacto_id bigint,
    nombre_original character varying(255) NOT NULL,
    mime_type character varying(120) NOT NULL,
    tamano_bytes bigint NOT NULL,
    url text NOT NULL,
    hash_sha256 character varying(64),
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.adjuntos OWNER TO chatbotcrm;

--
-- Name: adjuntos_id_adjunto_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.adjuntos_id_adjunto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.adjuntos_id_adjunto_seq OWNER TO chatbotcrm;

--
-- Name: adjuntos_id_adjunto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.adjuntos_id_adjunto_seq OWNED BY public.adjuntos.id_adjunto;


--
-- Name: agentes_en_linea; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.agentes_en_linea (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    estado character varying(20) NOT NULL,
    capacidad_max integer DEFAULT 3 NOT NULL,
    ultima_actividad_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.agentes_en_linea OWNER TO chatbotcrm;

--
-- Name: agentes_en_linea_id_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.agentes_en_linea_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agentes_en_linea_id_seq OWNER TO chatbotcrm;

--
-- Name: agentes_en_linea_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.agentes_en_linea_id_seq OWNED BY public.agentes_en_linea.id;


--
-- Name: asignaciones; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.asignaciones (
    id_asignacion bigint NOT NULL,
    empresa_id bigint NOT NULL,
    conversacion_id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    accion character varying(20) NOT NULL,
    razon text,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.asignaciones OWNER TO chatbotcrm;

--
-- Name: asignaciones_id_asignacion_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.asignaciones_id_asignacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asignaciones_id_asignacion_seq OWNER TO chatbotcrm;

--
-- Name: asignaciones_id_asignacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.asignaciones_id_asignacion_seq OWNED BY public.asignaciones.id_asignacion;


--
-- Name: contactos; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.contactos (
    id_contacto bigint NOT NULL,
    empresa_id bigint NOT NULL,
    tipo character varying(20) NOT NULL,
    nombre character varying(200) NOT NULL,
    email character varying(150),
    telefono character varying(30),
    tipo_documento character varying(10),
    documento character varying(30),
    tags text,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cargo character varying(100)
);


ALTER TABLE public.contactos OWNER TO chatbotcrm;

--
-- Name: contactos_id_contacto_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.contactos_id_contacto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contactos_id_contacto_seq OWNER TO chatbotcrm;

--
-- Name: contactos_id_contacto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.contactos_id_contacto_seq OWNED BY public.contactos.id_contacto;


--
-- Name: conversaciones; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.conversaciones (
    id_conversacion bigint NOT NULL,
    empresa_id bigint NOT NULL,
    contacto_id bigint NOT NULL,
    canal character varying(30) NOT NULL,
    tema character varying(30) NOT NULL,
    estado character varying(20) NOT NULL,
    prioridad character varying(20),
    asignada_a_usuario_id bigint,
    asignada_en timestamp with time zone,
    bloqueada_hasta timestamp with time zone,
    ultima_actividad_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    creada_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cerrada_en timestamp with time zone,
    CONSTRAINT chk_conversaciones_estado CHECK (((estado)::text = ANY ((ARRAY['EN_COLA'::character varying, 'ASIGNADA'::character varying, 'ACTIVA'::character varying, 'CERRADA'::character varying])::text[])))
);


ALTER TABLE public.conversaciones OWNER TO chatbotcrm;

--
-- Name: conversaciones_id_conversacion_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.conversaciones_id_conversacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversaciones_id_conversacion_seq OWNER TO chatbotcrm;

--
-- Name: conversaciones_id_conversacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.conversaciones_id_conversacion_seq OWNED BY public.conversaciones.id_conversacion;


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.empresas (
    id_empresa bigint NOT NULL,
    nit character varying(20) NOT NULL,
    nombre_empresa character varying(200) NOT NULL,
    estado boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.empresas OWNER TO chatbotcrm;

--
-- Name: empresas_id_empresa_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.empresas_id_empresa_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.empresas_id_empresa_seq OWNER TO chatbotcrm;

--
-- Name: empresas_id_empresa_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.empresas_id_empresa_seq OWNED BY public.empresas.id_empresa;


--
-- Name: knex_migrations; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


ALTER TABLE public.knex_migrations OWNER TO chatbotcrm;

--
-- Name: knex_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.knex_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knex_migrations_id_seq OWNER TO chatbotcrm;

--
-- Name: knex_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.knex_migrations_id_seq OWNED BY public.knex_migrations.id;


--
-- Name: knex_migrations_lock; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.knex_migrations_lock (
    index integer NOT NULL,
    is_locked integer
);


ALTER TABLE public.knex_migrations_lock OWNER TO chatbotcrm;

--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.knex_migrations_lock_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNER TO chatbotcrm;

--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNED BY public.knex_migrations_lock.index;


--
-- Name: llamadas; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.llamadas (
    id_llamada bigint NOT NULL,
    empresa_id bigint NOT NULL,
    conversacion_id bigint NOT NULL,
    tipo character varying(10) NOT NULL,
    estado character varying(20) NOT NULL,
    iniciada_por_tipo character varying(20) NOT NULL,
    iniciada_por_usuario_id bigint,
    iniciada_por_contacto_id bigint,
    agente_asignado_id bigint,
    webrtc_room_id character varying(120) NOT NULL,
    inicio_en timestamp with time zone,
    fin_en timestamp with time zone,
    duracion_seg integer,
    motivo_fin text,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.llamadas OWNER TO chatbotcrm;

--
-- Name: llamadas_id_llamada_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.llamadas_id_llamada_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.llamadas_id_llamada_seq OWNER TO chatbotcrm;

--
-- Name: llamadas_id_llamada_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.llamadas_id_llamada_seq OWNED BY public.llamadas.id_llamada;


--
-- Name: mensajes; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.mensajes (
    id_mensaje bigint NOT NULL,
    empresa_id bigint NOT NULL,
    conversacion_id bigint NOT NULL,
    tipo_emisor character varying(20) NOT NULL,
    usuario_id bigint,
    contacto_id bigint,
    contenido text NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.mensajes OWNER TO chatbotcrm;

--
-- Name: mensajes_id_mensaje_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.mensajes_id_mensaje_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mensajes_id_mensaje_seq OWNER TO chatbotcrm;

--
-- Name: mensajes_id_mensaje_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.mensajes_id_mensaje_seq OWNED BY public.mensajes.id_mensaje;


--
-- Name: mensajes_salas; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.mensajes_salas (
    id_mensaje_sala bigint NOT NULL,
    sala_id bigint NOT NULL,
    usuario_envia_id bigint NOT NULL,
    contenido text NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.mensajes_salas OWNER TO chatbotcrm;

--
-- Name: mensajes_salas_id_mensaje_sala_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.mensajes_salas_id_mensaje_sala_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mensajes_salas_id_mensaje_sala_seq OWNER TO chatbotcrm;

--
-- Name: mensajes_salas_id_mensaje_sala_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.mensajes_salas_id_mensaje_sala_seq OWNED BY public.mensajes_salas.id_mensaje_sala;


--
-- Name: miembros_salas; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.miembros_salas (
    sala_id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    rol_en_sala character varying(20),
    agregado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.miembros_salas OWNER TO chatbotcrm;

--
-- Name: participantes_llamada; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.participantes_llamada (
    id bigint NOT NULL,
    llamada_id bigint NOT NULL,
    tipo_participante character varying(20) NOT NULL,
    usuario_id bigint,
    contacto_id bigint,
    estado character varying(20) NOT NULL,
    join_en timestamp with time zone,
    leave_en timestamp with time zone
);


ALTER TABLE public.participantes_llamada OWNER TO chatbotcrm;

--
-- Name: participantes_llamada_id_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.participantes_llamada_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.participantes_llamada_id_seq OWNER TO chatbotcrm;

--
-- Name: participantes_llamada_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.participantes_llamada_id_seq OWNED BY public.participantes_llamada.id;


--
-- Name: preguntas_frecuentes; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.preguntas_frecuentes (
    id integer NOT NULL,
    tema_id integer NOT NULL,
    pregunta character varying(500) NOT NULL,
    respuesta text NOT NULL,
    orden integer DEFAULT 1,
    estado boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.preguntas_frecuentes OWNER TO chatbotcrm;

--
-- Name: preguntas_frecuentes_id_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.preguntas_frecuentes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.preguntas_frecuentes_id_seq OWNER TO chatbotcrm;

--
-- Name: preguntas_frecuentes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.preguntas_frecuentes_id_seq OWNED BY public.preguntas_frecuentes.id;


--
-- Name: salas; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.salas (
    id_sala bigint NOT NULL,
    empresa_id bigint NOT NULL,
    name character varying(120) NOT NULL,
    creado_por_usuario_id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.salas OWNER TO chatbotcrm;

--
-- Name: salas_id_sala_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.salas_id_sala_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.salas_id_sala_seq OWNER TO chatbotcrm;

--
-- Name: salas_id_sala_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.salas_id_sala_seq OWNED BY public.salas.id_sala;


--
-- Name: seguimiento_atenciones; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.seguimiento_atenciones (
    id_seguimiento bigint NOT NULL,
    empresa_id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    contacto_id bigint NOT NULL,
    conversacion_id bigint NOT NULL,
    accion character varying(20) NOT NULL,
    detalle text,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.seguimiento_atenciones OWNER TO chatbotcrm;

--
-- Name: seguimiento_atenciones_id_seguimiento_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.seguimiento_atenciones_id_seguimiento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.seguimiento_atenciones_id_seguimiento_seq OWNER TO chatbotcrm;

--
-- Name: seguimiento_atenciones_id_seguimiento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.seguimiento_atenciones_id_seguimiento_seq OWNED BY public.seguimiento_atenciones.id_seguimiento;


--
-- Name: temas_preguntas; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.temas_preguntas (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    orden integer DEFAULT 1,
    estado boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.temas_preguntas OWNER TO chatbotcrm;

--
-- Name: temas_preguntas_id_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.temas_preguntas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.temas_preguntas_id_seq OWNER TO chatbotcrm;

--
-- Name: temas_preguntas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.temas_preguntas_id_seq OWNED BY public.temas_preguntas.id;


--
-- Name: usuarios_soporte; Type: TABLE; Schema: public; Owner: chatbotcrm
--

CREATE TABLE public.usuarios_soporte (
    id_usuario bigint NOT NULL,
    username character varying(120) NOT NULL,
    tipo_documento character varying(10),
    documento character varying(30),
    password_hash text NOT NULL,
    rol character varying(30) NOT NULL,
    nivel integer DEFAULT 5 NOT NULL,
    estado boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    nombre_completo character varying(200),
    sesion_token character varying(500)
);


ALTER TABLE public.usuarios_soporte OWNER TO chatbotcrm;

--
-- Name: usuarios_soporte_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: chatbotcrm
--

CREATE SEQUENCE public.usuarios_soporte_id_usuario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_soporte_id_usuario_seq OWNER TO chatbotcrm;

--
-- Name: usuarios_soporte_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: chatbotcrm
--

ALTER SEQUENCE public.usuarios_soporte_id_usuario_seq OWNED BY public.usuarios_soporte.id_usuario;


--
-- Name: adjuntos id_adjunto; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.adjuntos ALTER COLUMN id_adjunto SET DEFAULT nextval('public.adjuntos_id_adjunto_seq'::regclass);


--
-- Name: agentes_en_linea id; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.agentes_en_linea ALTER COLUMN id SET DEFAULT nextval('public.agentes_en_linea_id_seq'::regclass);


--
-- Name: asignaciones id_asignacion; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.asignaciones ALTER COLUMN id_asignacion SET DEFAULT nextval('public.asignaciones_id_asignacion_seq'::regclass);


--
-- Name: contactos id_contacto; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.contactos ALTER COLUMN id_contacto SET DEFAULT nextval('public.contactos_id_contacto_seq'::regclass);


--
-- Name: conversaciones id_conversacion; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.conversaciones ALTER COLUMN id_conversacion SET DEFAULT nextval('public.conversaciones_id_conversacion_seq'::regclass);


--
-- Name: empresas id_empresa; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.empresas ALTER COLUMN id_empresa SET DEFAULT nextval('public.empresas_id_empresa_seq'::regclass);


--
-- Name: knex_migrations id; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.knex_migrations ALTER COLUMN id SET DEFAULT nextval('public.knex_migrations_id_seq'::regclass);


--
-- Name: knex_migrations_lock index; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.knex_migrations_lock ALTER COLUMN index SET DEFAULT nextval('public.knex_migrations_lock_index_seq'::regclass);


--
-- Name: llamadas id_llamada; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.llamadas ALTER COLUMN id_llamada SET DEFAULT nextval('public.llamadas_id_llamada_seq'::regclass);


--
-- Name: mensajes id_mensaje; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.mensajes ALTER COLUMN id_mensaje SET DEFAULT nextval('public.mensajes_id_mensaje_seq'::regclass);


--
-- Name: mensajes_salas id_mensaje_sala; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.mensajes_salas ALTER COLUMN id_mensaje_sala SET DEFAULT nextval('public.mensajes_salas_id_mensaje_sala_seq'::regclass);


--
-- Name: participantes_llamada id; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.participantes_llamada ALTER COLUMN id SET DEFAULT nextval('public.participantes_llamada_id_seq'::regclass);


--
-- Name: preguntas_frecuentes id; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.preguntas_frecuentes ALTER COLUMN id SET DEFAULT nextval('public.preguntas_frecuentes_id_seq'::regclass);


--
-- Name: salas id_sala; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.salas ALTER COLUMN id_sala SET DEFAULT nextval('public.salas_id_sala_seq'::regclass);


--
-- Name: seguimiento_atenciones id_seguimiento; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.seguimiento_atenciones ALTER COLUMN id_seguimiento SET DEFAULT nextval('public.seguimiento_atenciones_id_seguimiento_seq'::regclass);


--
-- Name: temas_preguntas id; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.temas_preguntas ALTER COLUMN id SET DEFAULT nextval('public.temas_preguntas_id_seq'::regclass);


--
-- Name: usuarios_soporte id_usuario; Type: DEFAULT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.usuarios_soporte ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuarios_soporte_id_usuario_seq'::regclass);


--
-- Data for Name: adjuntos; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.adjuntos (id_adjunto, empresa_id, conversacion_id, mensaje_id, subido_por_tipo, subido_por_usuario_id, subido_por_contacto_id, nombre_original, mime_type, tamano_bytes, url, hash_sha256, creado_en) FROM stdin;
\.


--
-- Data for Name: agentes_en_linea; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.agentes_en_linea (id, empresa_id, usuario_id, estado, capacidad_max, ultima_actividad_en) FROM stdin;
\.


--
-- Data for Name: asignaciones; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.asignaciones (id_asignacion, empresa_id, conversacion_id, usuario_id, accion, razon, creado_en) FROM stdin;
1	2	1	2	ASIGNAR	Asignación desde CRM	2026-02-08 02:58:58.357894+00
2	4	3	1	ASIGNAR	Asignación desde CRM	2026-02-12 00:43:43.497204+00
3	1	2	1	ASIGNAR	Asignación desde CRM	2026-02-12 01:25:53.107155+00
4	4	3	3	TRANSFERIR	Prueba	2026-02-12 01:40:22.624043+00
5	4	3	2	TRANSFERIR	Una  prueba de  transferencia	2026-02-12 02:34:37.122914+00
6	4	3	3	TRANSFERIR	Se  lo devuelvo no es para  mi	2026-02-12 02:42:36.709785+00
7	6	5	1	ASIGNAR	Asignación desde CRM	2026-02-12 21:15:04.921624+00
8	7	6	3	ASIGNAR	Asignación desde CRM	2026-02-13 14:18:19.556889+00
9	10	9	2	ASIGNAR	Asignación desde CRM	2026-02-17 02:39:45.317258+00
10	10	9	3	TRANSFERIR	Transferida por atamayo	2026-02-17 02:39:59.341269+00
\.


--
-- Data for Name: contactos; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.contactos (id_contacto, empresa_id, tipo, nombre, email, telefono, tipo_documento, documento, tags, creado_en, cargo) FROM stdin;
1	1	CLIENTE	Vladimir	\N	\N	CC	1035874628	\N	2026-02-08 02:57:10.595513+00	Auxiliar
2	2	CLIENTE	jefer	\N	\N	CC	1035874629	\N	2026-02-08 02:57:47.875427+00	Gerente
3	4	CLIENTE	Claudia Marcela Gómez	\N	\N	CC	1122334455	\N	2026-02-08 22:35:41.809281+00	Director de Proyecto
4	5	CLIENTE	Luis Fernando Castillo	\N	\N	CC	9012345678	\N	2026-02-10 02:47:05.968753+00	Director de Proyecto
5	6	CLIENTE	Jorge Luis Vargas	\N	\N	CC	3456789012	\N	2026-02-12 20:21:50.253361+00	Director de Proyecto
6	7	CLIENTE	María Fernanda Rojas	\N	\N	CC	2345678901	\N	2026-02-13 14:17:53.306952+00	Director de Proyecto
7	8	CLIENTE	Ana Patricia Suárez	\N	\N	CC	4567890123	\N	2026-02-13 18:15:28.361239+00	Director de Proyecto
8	9	CLIENTE	Roberto Carlos Jiménez	\N	\N	CC	5678901234	\N	2026-02-13 18:16:31.620112+00	Director de Proyecto
9	10	CLIENTE	Carlos Andrés Méndez	\N	\N	CC	1234567890	\N	2026-02-13 19:39:54.420941+00	Director de Proyecto
10	5	CLIENTE	Patricia Andrea Silva	\N	\N	CC	9012345679	\N	2026-02-13 19:44:36.691206+00	Director de Proyecto
\.


--
-- Data for Name: conversaciones; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.conversaciones (id_conversacion, empresa_id, contacto_id, canal, tema, estado, prioridad, asignada_a_usuario_id, asignada_en, bloqueada_hasta, ultima_actividad_en, creada_en, cerrada_en) FROM stdin;
8	9	8	WEB	SOPORTE	EN_COLA	MEDIA	\N	\N	\N	2026-02-13 19:37:27.460899+00	2026-02-13 18:16:32.527224+00	\N
10	5	10	WEB	SOPORTE	EN_COLA	MEDIA	\N	\N	\N	2026-02-13 19:46:15.317476+00	2026-02-13 19:44:54.872687+00	\N
1	2	2	WEB	SOPORTE	CERRADA	MEDIA	2	2026-02-08 02:58:58.342675+00	\N	2026-02-12 01:25:36.364693+00	2026-02-08 02:57:50.516387+00	2026-02-12 01:25:36.364693+00
2	1	1	WEB	SOPORTE	CERRADA	MEDIA	1	2026-02-12 01:25:53.077427+00	\N	2026-02-12 01:26:14.049428+00	2026-02-08 02:58:03.665855+00	2026-02-12 01:26:14.049428+00
6	7	6	WEB	SOPORTE	ACTIVA	MEDIA	3	2026-02-13 14:18:19.319117+00	\N	2026-02-13 14:18:43.06709+00	2026-02-13 14:17:55.03815+00	\N
3	4	3	WEB	SOPORTE	ASIGNADA	MEDIA	3	2026-02-12 02:42:36.663147+00	\N	2026-02-13 17:28:59.389796+00	2026-02-10 02:52:52.577673+00	\N
4	5	4	WEB	SOPORTE	EN_COLA	MEDIA	\N	\N	\N	2026-02-13 18:02:45.881955+00	2026-02-10 02:58:14.12467+00	\N
9	10	9	WEB	SOPORTE	ACTIVA	MEDIA	3	2026-02-17 02:39:59.15216+00	\N	2026-02-17 14:49:50.03582+00	2026-02-13 19:39:55.797464+00	\N
5	6	5	WEB	SOPORTE	ASIGNADA	MEDIA	1	2026-02-12 21:15:04.83951+00	\N	2026-02-13 18:10:53.880443+00	2026-02-12 20:23:53.422223+00	\N
7	8	7	WEB	SOPORTE	EN_COLA	MEDIA	\N	\N	\N	2026-02-13 18:15:30.212089+00	2026-02-13 18:15:30.177269+00	\N
\.


--
-- Data for Name: empresas; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.empresas (id_empresa, nit, nombre_empresa, estado, creado_en) FROM stdin;
1	811021438	HGISAS	t	2026-02-08 02:56:59.853318+00
2	811021439	Grupo soft	t	2026-02-08 02:57:35.365608+00
3	900123456-1	CONSTRUCTORA ANDINA S.A.S	t	2026-02-08 21:46:40.151708+00
4	123456789	MEGAPROYECTOS Y CONSTRUCCIONES DEL CENTRO S.A.S	t	2026-02-08 22:27:23.470596+00
5	100901234	CORPORACIÓN TECNOLÓGICA DE ORIENTE S.A	t	2026-02-10 02:47:05.926148+00
6	700345678	COMERCIALIZADORA DEL PACIFICO S.A	t	2026-02-12 20:21:50.145418+00
7	800234567	TECNOLOGÍA DIGITAL LTDA	t	2026-02-13 14:17:52.842224+00
8	600456789	INVERSIONES Y SERVICIOS LA COSTA S.A.S	t	2026-02-13 18:15:28.333658+00
9	500567890	GRUPO EMPRESARIAL DEL NORTE LTDA	t	2026-02-13 18:16:31.597927+00
10	900123456	CONSTRUCTORA ANDINA S.A.S	t	2026-02-13 19:39:54.363527+00
\.


--
-- Data for Name: knex_migrations; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.knex_migrations (id, name, batch, migration_time) FROM stdin;
1	001_create_initial_tables.ts	1	2026-02-06 03:36:30.703+00
2	002_add_cargo_to_contactos.ts	1	2026-02-06 03:36:30.747+00
3	003_unique_conversacion_activa_por_contacto.ts	1	2026-02-06 03:36:30.769+00
4	004_estado_conversacion_solo_tres.ts	1	2026-02-06 03:36:30.777+00
5	005_create_preguntas_frecuentes.ts	2	2026-02-07 02:55:16.791+00
6	006_add_nombre_completo_to_usuarios_soporte.ts	3	2026-02-08 20:06:13.185+00
7	007_add_sesion_token_to_usuarios_soporte.ts	4	2026-02-12 02:45:02.974+00
8	008_add_activa_estado_conversacion.ts	5	2026-02-13 14:12:10.69+00
\.


--
-- Data for Name: knex_migrations_lock; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.knex_migrations_lock (index, is_locked) FROM stdin;
1	0
\.


--
-- Data for Name: llamadas; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.llamadas (id_llamada, empresa_id, conversacion_id, tipo, estado, iniciada_por_tipo, iniciada_por_usuario_id, iniciada_por_contacto_id, agente_asignado_id, webrtc_room_id, inicio_en, fin_en, duracion_seg, motivo_fin, creado_en) FROM stdin;
\.


--
-- Data for Name: mensajes; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.mensajes (id_mensaje, empresa_id, conversacion_id, tipo_emisor, usuario_id, contacto_id, contenido, creado_en) FROM stdin;
1	2	1	CONTACTO	\N	2	Hola	2026-02-08 02:57:55.968653+00
2	1	2	CONTACTO	\N	1	hola	2026-02-08 02:58:06.37787+00
3	2	1	AGENTE	2	\N	Como estas  en que le puedo servir?	2026-02-08 02:59:19.531219+00
4	1	2	CONTACTO	\N	1	Como estas?	2026-02-08 17:50:21.037326+00
5	4	3	CONTACTO	\N	3	hola	2026-02-10 02:52:55.65307+00
6	5	4	BOT	\N	\N	¡Hola Luis Fernando Castillo de CORPORACIÓN TECNOLÓGICA DE ORIENTE S.A! 👋\nSoy Isa, tu asistente virtual.\n\nPor favor elige una opción escribiendo el número correspondiente:\n\n1️⃣ Nómina  \n2️⃣ Administrativo  \n3️⃣ Post  \n4️⃣ Contable  \n\n¿En qué puedo ayudarte hoy?	2026-02-10 02:58:14.18834+00
7	5	4	CONTACTO	\N	4	1	2026-02-10 02:58:17.88403+00
8	5	4	BOT	\N	\N	Lo sentimos, pero tu empresa no está registrada.	2026-02-10 02:58:18.429322+00
9	5	4	CONTACTO	\N	4	como que no	2026-02-10 02:58:29.831207+00
10	5	4	BOT	\N	\N	Lo sentimos, pero tu empresa no está registrada.	2026-02-10 02:58:30.540936+00
11	5	4	CONTACTO	\N	4	porque	2026-02-10 02:59:27.506987+00
12	5	4	BOT	\N	\N	Lo sentimos, pero tu empresa no está registrada.	2026-02-10 02:59:28.200428+00
13	5	4	BOT	\N	\N	¡Hola Luis Fernando Castillo de CORPORACIÓN TECNOLÓGICA DE ORIENTE S.A! 👋\nSoy Isa, tu asistente virtual.\n\nPor favor elige una opción escribiendo el número correspondiente:\n\n1️⃣ Nómina  \n2️⃣ Administrativo  \n3️⃣ Post  \n4️⃣ Contable  \n\n¿En qué puedo ayudarte hoy?	2026-02-10 14:46:55.653652+00
14	5	4	CONTACTO	\N	4	hola	2026-02-10 14:46:59.502763+00
15	5	4	BOT	\N	\N	❌ Debes enviar SOLO números. Ejemplo: 900123456	2026-02-10 14:47:01.39201+00
16	4	3	CONTACTO	\N	3	hola	2026-02-12 00:43:27.552373+00
17	4	3	AGENTE	1	\N	como estas	2026-02-12 00:43:50.638969+00
18	4	3	SISTEMA	\N	\N	🔄 Conversación transferida de ebustamante a Sebastian Santa — Motivo: Prueba	2026-02-12 01:40:22.64942+00
19	4	3	AGENTE	3	\N	Hola	2026-02-12 01:41:22.689821+00
20	4	3	AGENTE	3	\N	hola	2026-02-12 01:49:49.575604+00
21	4	3	CONTACTO	\N	3	hola	2026-02-12 01:50:10.612975+00
22	4	3	AGENTE	3	\N	hola	2026-02-12 01:50:35.132823+00
23	4	3	AGENTE	3	\N	bien	2026-02-12 01:50:45.41707+00
24	4	3	AGENTE	3	\N	yyyyyy	2026-02-12 01:50:54.968705+00
25	4	3	SISTEMA	\N	\N	🔄 Conversación transferida de santa a Ana Maria Tamayo — Motivo: Una  prueba de  transferencia	2026-02-12 02:34:37.160607+00
26	4	3	AGENTE	2	\N	hola  como estas	2026-02-12 02:35:07.417772+00
27	4	3	SISTEMA	\N	\N	🔄 Conversación transferida de atamayo a Sebastian Santa — Motivo: Se  lo devuelvo no es para  mi	2026-02-12 02:42:36.73617+00
28	4	3	AGENTE	3	\N	hola	2026-02-12 02:42:48.91186+00
29	4	3	AGENTE	3	\N	como estas	2026-02-12 02:43:06.048676+00
30	6	5	CONTACTO	\N	5	hol	2026-02-12 21:14:56.356717+00
31	6	5	AGENTE	1	\N	ghjkjkk	2026-02-12 21:15:07.907176+00
32	6	5	AGENTE	1	\N	nnnnnnn	2026-02-12 21:15:29.980912+00
33	6	5	BOT	\N	\N	¡Hola Jorge Luis Vargas de COMERCIALIZADORA DEL PACIFICO S.A! 👋\nSoy Isa, tu asistente virtual.\n\nPor favor elige una opción escribiendo el número correspondiente:\n\n1️⃣ Nómina  \n2️⃣ Administrativo  \n3️⃣ Post  \n4️⃣ Contable  \n\n¿En qué puedo ayudarte hoy?	2026-02-12 21:16:24.535253+00
34	6	5	CONTACTO	\N	5	hola	2026-02-12 21:16:29.111308+00
35	6	5	BOT	\N	\N	❌ Debes enviar SOLO números. Ejemplo: 900123456	2026-02-12 21:16:29.711168+00
36	6	5	CONTACTO	\N	5	811021438	2026-02-12 21:16:36.730464+00
37	7	6	CONTACTO	\N	6	hola	2026-02-13 14:17:58.372606+00
38	7	6	AGENTE	3	\N	hola	2026-02-13 14:18:29.290622+00
39	7	6	CONTACTO	\N	6	como estas	2026-02-13 14:18:42.916709+00
40	4	3	BOT	\N	\N	¡Hola Claudia Marcela Gómez de MEGAPROYECTOS Y CONSTRUCCIONES DEL CENTRO S.A.S! 👋\nSoy Isa, tu asistente virtual.\n\nPor favor elige una opción escribiendo el número correspondiente:\n\n1️⃣ Nómina  \n2️⃣ Administrativo  \n3️⃣ Post  \n4️⃣ Contable  \n\n¿En qué puedo ayudarte hoy?	2026-02-13 17:28:48.00626+00
41	4	3	CONTACTO	\N	3	hola	2026-02-13 17:28:53.152485+00
42	4	3	BOT	\N	\N	❌ Debes enviar SOLO números. Ejemplo: 900123456	2026-02-13 17:28:54.000481+00
43	4	3	CONTACTO	\N	3	811021438	2026-02-13 17:28:59.382588+00
44	5	4	CONTACTO	\N	4	hola	2026-02-13 18:02:45.843859+00
45	6	5	BOT	\N	\N	¡Hola Jorge Luis Vargas de COMERCIALIZADORA DEL PACIFICO S.A! 👋\nSoy Isa, tu asistente virtual.\n\nPor favor elige una opción escribiendo el número correspondiente:\n\n1️⃣ Nómina  \n2️⃣ Administrativo  \n3️⃣ Post  \n4️⃣ Contable  \n\n¿En qué puedo ayudarte hoy?	2026-02-13 18:10:24.946364+00
46	6	5	CONTACTO	\N	5	Hola	2026-02-13 18:10:53.616091+00
47	6	5	BOT	\N	\N	❌ Debes enviar SOLO números. Ejemplo: 900123456	2026-02-13 18:10:53.874096+00
48	8	7	BOT	\N	\N	¡Hola Ana Patricia Suárez de INVERSIONES Y SERVICIOS LA COSTA S.A.S! 👋\nSoy Isa, tu asistente virtual.\n\nPor favor elige una opción escribiendo el número correspondiente:\n\n1️⃣ Nómina  \n2️⃣ Administrativo  \n3️⃣ Post  \n4️⃣ Contable  \n\n¿En qué puedo ayudarte hoy?	2026-02-13 18:15:30.202996+00
49	9	8	CONTACTO	\N	8	Buenas  tardes	2026-02-13 18:16:45.70422+00
50	9	8	BOT	\N	\N	¡Hola Roberto Carlos Jiménez de GRUPO EMPRESARIAL DEL NORTE LTDA! 👋\nSoy Isa, tu asistente virtual.\n\nPor favor elige una opción escribiendo el número correspondiente:\n\n1️⃣ Nómina  \n2️⃣ Administrativo  \n3️⃣ Post  \n4️⃣ Contable  \n\n¿En qué puedo ayudarte hoy?	2026-02-13 19:37:27.432828+00
51	10	9	BOT	\N	\N	¡Hola Carlos Andrés Méndez de CONSTRUCTORA ANDINA S.A.S! 👋\nSoy Isa, tu asistente virtual.\n\nPor favor elige una opción escribiendo el número correspondiente:\n\n1️⃣ Nómina  \n2️⃣ Administrativo  \n3️⃣ Post  \n4️⃣ Contable  \n\n¿En qué puedo ayudarte hoy?	2026-02-13 19:39:55.816259+00
52	5	10	BOT	\N	\N	¡Hola Patricia Andrea Silva de CORPORACIÓN TECNOLÓGICA DE ORIENTE S.A! 👋\nSoy Isa, tu asistente virtual.\n\nPor favor elige una opción escribiendo el número correspondiente:\n\n1️⃣ Nómina  \n2️⃣ Administrativo  \n3️⃣ Post  \n4️⃣ Contable  \n\n¿En qué puedo ayudarte hoy?	2026-02-13 19:44:54.901593+00
53	5	10	CONTACTO	\N	10	HGI NOMINA	2026-02-13 19:46:07.888333+00
54	5	10	BOT	\N	\N	HGI Nómina es una solución especializada para la gestión de nóminas, ofreciendo funcionalidades adaptadas a las necesidades de las empresas para manejar pagos y cumplir con requisitos legales. Actualmente, el sistema se encuentra en una fase de revisión y desarrollo para asegurar la calidad de las mejoras implementadas. Si tienes alguna pregunta específica o necesitas más detalles, estoy aquí para asistirte.	2026-02-13 19:46:15.310173+00
55	10	9	BOT	\N	\N	¡Hola Carlos Andrés Méndez de CONSTRUCTORA ANDINA S.A.S! 👋\nSoy Isa, tu asistente virtual.\n\nPor favor elige una opción escribiendo el número correspondiente:\n\n1️⃣ Nómina  \n2️⃣ Administrativo  \n3️⃣ Post  \n4️⃣ Contable  \n\n¿En qué puedo ayudarte hoy?	2026-02-13 19:48:22.455294+00
63	10	9	BOT	\N	\N	HGI_Administrativo está diseñado para gestionar de manera eficiente el seguimiento y control de oportunidades comerciales. Permite registrar los datos del cliente, definir intereses, etapas y presupuestos, agendar actividades de seguimiento, y controlar la evolución de cada oportunidad hasta su cierre. Esto se documenta detalladamente en la sección de Oportunidades, facilitando un manejo integral de la cartera. Si tienes alguna pregunta específica sobre su funcionamiento, con gusto te ayudaré.	2026-02-13 20:26:03.030254+00
64	10	9	CONTACTO	\N	9	cambio clave usuario admin	2026-02-13 20:26:32.812863+00
66	10	9	CONTACTO	\N	9	si tengo perfil admin que debo hacer?	2026-02-13 20:27:04.956351+00
67	10	9	BOT	\N	\N	Si tienes un perfil de administrador, se te otorgan opciones adicionales y permisos especiales para gestionar y configurar el sistema. Esto incluye la capacidad de acceder a módulos administrativos, realizar configuraciones avanzadas y gestionar usuarios. Es importante asegurar que estos privilegios se utilicen de manera responsable para mantener la seguridad y funcionalidad del sistema. Si necesitas actuar en un área específica, asegúrate de que los prerrequisitos estén cumplidos y consulta siempre con las políticas de la empresa. Si tienes dudas adicionales, estoy aquí para ayudarte.	2026-02-13 20:27:15.088017+00
68	10	9	CONTACTO	\N	9	como la cambio?	2026-02-13 20:27:44.782624+00
70	10	9	CONTACTO	\N	9	modelos de balanzas	2026-02-13 20:29:22.382761+00
71	10	9	BOT	\N	\N	Para gestionar modelos de balanzas con la solución de HGI, debes considerar varios aspectos clave:\n\n1. **Selección de Marca**: Es importante seleccionar correctamente la marca de la balanza que tienes instalada, ya que esto garantizará la compatibilidad con el sistema.\n\n2. **Conexión**: Asegúrate de que la balanza esté conectada correctamente al sistema HGI utilizando la IP de los servicios web instalados.\n\n3. **Ruta de Archivos**: Define la ruta local para almacenar los tickets generados por la balanza, los cuales serán leídos posteriormente por el sistema.\n\n4. **Integración con ERP**: Puedes integrar las balanzas con el ERP, seleccionando las bodegas y empresas correspondientes configuradas en el sistema.\n\nEstos pasos asegurarán que las balanzas funcionen de manera eficiente dentro de la infraestructura de gestión de HGI.	2026-02-13 20:29:35.057326+00
73	10	9	BOT	\N	\N	La lectura de tickets en el sistema de HGI se realiza principalmente mediante dos métodos:\n\n1. **Lectura con Servicio de Balanza**: Esta opción es compatible con las balanzas EPELSA, DIBAL y MARQUES.\n\n2. **Solo Ticket**: Permite la lectura de tickets generados por dispositivos de tipo balanza que contienen información sobre el código del producto y su peso.\n\nAmbas opciones requieren una correcta parametrización en el software para asegurar la captura precisa de la información necesaria. Si necesitas más detalles o ayuda con la configuración, estoy aquí para ayudarte.	2026-02-13 20:30:23.199917+00
76	10	9	CONTACTO	\N	9	como genero un tickets?	2026-02-13 20:37:23.611664+00
78	10	9	CONTACTO	\N	9	HGI_Administrativo	2026-02-13 22:04:47.626569+00
79	10	9	BOT	\N	\N	HGI_Administrativo se centra en gestionar y registrar datos de clientes, definir intereses, etapas y presupuestos, y agendar actividades de seguimiento. Su objetivo es controlar la evolución de cada oportunidad hasta su cierre, documentando los detalles en el módulo de Oportunidades. ¿Tienes alguna pregunta específica sobre estas funcionalidades?	2026-02-13 22:04:59.890984+00
80	10	9	CONTACTO	\N	9	cuale  son las  marcas de balanzas que manejan ?	2026-02-13 22:05:18.137524+00
81	10	9	BOT	\N	\N	Las marcas de balanzas que maneja HGI incluyen EPELSA, DIBAL y MARQUES. Estas pueden ser configuradas a través del sistema HgiBalanzas para asegurar una correcta integración y funcionamiento en el entorno deseado. ¿Necesitas información adicional sobre alguna de estas marcas?	2026-02-13 22:05:28.096546+00
56	10	9	CONTACTO	\N	9	HGI_Administrativo	2026-02-13 19:51:44.215089+00
57	10	9	BOT	\N	\N	HGI_Administrativo se enfoca en gestionar datos del cliente, definir intereses, etapas y presupuestos, y agendar actividades de seguimiento. También controla la evolución de cada oportunidad hasta su cierre, documentando los detalles en las oportunidades. Si tienes alguna pregunta específica sobre estos procesos o necesitas más detalles, estaré encantado de asistirte.	2026-02-13 19:51:51.103188+00
58	10	9	CONTACTO	\N	9	HGI_Administrativo	2026-02-13 19:56:39.09961+00
59	10	9	BOT	\N	\N	HGI_Administrativo se enfoca en la gestión de oportunidades de negocio. Esto incluye registrar datos del cliente, definir el interés, la etapa y el presupuesto, además de agendar actividades de seguimiento. Se controla la evolución de cada oportunidad hasta su cierre, documentando cada detalle en las oportunidades. ¿En qué más puedo ayudarte?	2026-02-13 19:56:46.888886+00
60	10	9	CONTACTO	\N	9	HGI_Administrativo	2026-02-13 19:57:43.141247+00
61	10	9	BOT	\N	\N	HGI Administrativo se enfoca en la gestión de datos del cliente, incluyendo el registro de información relevante como intereses, etapas y presupuestos. También está diseñado para planificar actividades de seguimiento y controlar la evolución de cada oportunidad hasta su cierre. El proceso se documenta detalladamente en la sección de Oportunidades. ¿Hay algo específico en lo que te pueda ayudar sobre HGI Administrativo?	2026-02-13 19:57:51.189068+00
62	10	9	CONTACTO	\N	9	HGI_Administrativo	2026-02-13 20:25:55.065167+00
65	10	9	BOT	\N	\N	Para cambiar la clave del usuario admin, es importante verificar primero si el usuario tiene los permisos necesarios asignados y se le ha designado un perfil administrativo. Este proceso asegura que solo los usuarios autorizados puedan realizar cambios críticos en el sistema. Si necesitas más detalles sobre cómo proceder, no dudes en preguntarme.	2026-02-13 20:26:40.951535+00
69	10	9	BOT	\N	\N	Para cambiar la clave del usuario admin, sigue estos pasos:\n\n1. **Accede al sistema** usando tu cuenta de administrador.\n2. **Dirígete al módulo de administración** donde se gestionan los usuarios.\n3. **Selecciona la opción para modificar usuario** y elige el usuario admin.\n4. **Ingresa la nueva clave de acceso** y confirma el cambio.\n\nAsegúrate de cumplir con los requisitos de seguridad establecidos por la empresa para las contraseñas. Si tienes más preguntas, estoy aquí para ayudarte.	2026-02-13 20:27:53.408781+00
72	10	9	CONTACTO	\N	9	Lectura Tickets	2026-02-13 20:30:13.06384+00
74	10	9	CONTACTO	\N	9	Se me  olvido la  contraseña que pasos debo realizar?	2026-02-13 20:35:16.409372+00
75	10	9	BOT	\N	\N	Si olvidaste tu contraseña, sigue estos pasos para recuperarla:\n\n1. **Accede a la pantalla de inicio de sesión** en el sistema.\n2. Busca la opción para **recuperar contraseña o restablecer**.\n3. Ingresa el **NIT de la empresa** y el **usuario** que utilizas para ingresar al ERP.\n4. Sigue las instrucciones proporcionadas, que pueden incluir recibir un enlace por correo electrónico para restablecer tu contraseña.\n\nSi encuentras algún problema, es recomendable contactar al soporte técnico de HGI para asistencia adicional.	2026-02-13 20:35:28.174779+00
77	10	9	BOT	\N	\N	Para generar un ticket en el sistema de HGI, sigue estos pasos:\n\n1. **Lectura del Ticket**: El sistema permite la lectura del ticket a través del código de barras, capturando la información del código del producto y el peso correspondiente.\n\n2. **Proceso de Conversión**: El valor del peso se debe dividir entre 1000 para registrarlo en el campo de cantidad del documento.\n\n3. **EAN del Ticket**: Asegúrate de tener la parametrización correcta que permita la lectura del EAN del ticket físico generado por la balanza. Esto se puede hacer presionando F1 en el campo del producto en el detalle de documentos.\n\nSi necesitas más ayuda con el proceso, estoy aquí para asistir.	2026-02-13 20:37:34.629557+00
82	10	9	SISTEMA	\N	\N	🔄 Conversación transferida de atamayo a Sebastian Santa	2026-02-17 02:39:59.423393+00
83	10	9	AGENTE	3	\N	hola	2026-02-17 02:40:26.196981+00
84	10	9	CONTACTO	\N	9	HGI_Administrativo	2026-02-17 14:49:32.191577+00
85	10	9	BOT	\N	\N	En HGI Administrativo, se manejan diversos aspectos relacionados con la gestión de clientes. Esto incluye registrar datos, definir intereses, etapas y presupuestos, agendar actividades de seguimiento y controlar la evolución de cada oportunidad hasta su cierre. Toda esta información se documenta en la sección de Oportunidades. También se contemplan aspectos como Tipos de Cartera. Si tienes más preguntas o necesitas más detalles, estaré encantado de ayudarte.	2026-02-17 14:49:49.907637+00
\.


--
-- Data for Name: mensajes_salas; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.mensajes_salas (id_mensaje_sala, sala_id, usuario_envia_id, contenido, creado_en) FROM stdin;
\.


--
-- Data for Name: miembros_salas; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.miembros_salas (sala_id, usuario_id, rol_en_sala, agregado_en) FROM stdin;
\.


--
-- Data for Name: participantes_llamada; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.participantes_llamada (id, llamada_id, tipo_participante, usuario_id, contacto_id, estado, join_en, leave_en) FROM stdin;
\.


--
-- Data for Name: preguntas_frecuentes; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.preguntas_frecuentes (id, tema_id, pregunta, respuesta, orden, estado, created_at, updated_at) FROM stdin;
1	1	Como cambiar  contraseña	Se  debe redirigir a  este link https://www.youtube.com/ para ver  los pasos para realizar  los pasos	1	t	2026-02-07 03:40:02.997345+00	2026-02-07 03:40:02.997345+00
3	1	ytytyyyyy	3. GUIA-INTEGRACION-CRM.md\n✅ Instrucciones paso a paso\n✅ Configuración de rutas\n✅ Variables de entorno\n✅ Integración con Docker\n✅ Solución de problemas	2	t	2026-02-07 03:44:50.231222+00	2026-02-07 03:44:50.231222+00
4	2	Como recuperar  contraseña	Se debe redirigir a este link https://www.youtube.com/ para ver los pasos para realizar los pasos	1	t	2026-02-17 14:47:09.279929+00	2026-02-17 14:47:09.279929+00
\.


--
-- Data for Name: salas; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.salas (id_sala, empresa_id, name, creado_por_usuario_id, creado_en) FROM stdin;
\.


--
-- Data for Name: seguimiento_atenciones; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.seguimiento_atenciones (id_seguimiento, empresa_id, usuario_id, contacto_id, conversacion_id, accion, detalle, creado_en) FROM stdin;
\.


--
-- Data for Name: temas_preguntas; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.temas_preguntas (id, nombre, descripcion, orden, estado, created_at, updated_at) FROM stdin;
1	HGI Nómina	\N	1	t	2026-02-07 03:37:10.555083+00	2026-02-07 03:37:10.555083+00
2	HGI Administrativo	\N	2	t	2026-02-07 03:37:45.362482+00	2026-02-07 03:37:45.362482+00
3	HGI Contable	\N	3	t	2026-02-07 03:38:11.583731+00	2026-02-07 03:38:11.583731+00
4	HGI CRM	\N	4	t	2026-02-07 03:38:34.685684+00	2026-02-07 03:38:34.685684+00
5	HGI Docs	\N	5	t	2026-02-07 03:38:48.988868+00	2026-02-07 03:38:48.988868+00
\.


--
-- Data for Name: usuarios_soporte; Type: TABLE DATA; Schema: public; Owner: chatbotcrm
--

COPY public.usuarios_soporte (id_usuario, username, tipo_documento, documento, password_hash, rol, nivel, estado, creado_en, nombre_completo, sesion_token) FROM stdin;
4	jflores	CC	2222222222	$2a$10$e96QQY8rjx0LNkwjktSOO./9o8vRUTrbQcjyZeHZJoIO9g/8dcjr6	ASESOR	5	t	2026-02-08 21:10:01.300754+00	Jeferson Flores	\N
1	ebustamante	CC	1035874628	$2a$10$3ZMKSjp9kVpLwHVUBZiODO46p1mlbXfqGpLG78rDAJsnpXxU/S2Nq	ADMIN	10	t	2026-02-07 01:45:23.751588+00	Edwin Arlex Bustamante Osorio	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c3VhcmlvIjoiMSIsInVzZXJuYW1lIjoiZWJ1c3RhbWFudGUiLCJyb2wiOiJBRE1JTiIsImlhdCI6MTc3MTAwNjE1MywiZXhwIjoxNzcxNjEwOTUzfQ.EFtWAFICfIrrM6g4Cygc2TiXZrYxQ8Y19XeD8qTK5PM
3	ssanta	CC	1111111111	$2a$10$PQ1QF4r.bGbZgYU2IljZh.KuMbREgl4vjxVynxBfDvC37ZIHdr8N6	ASESOR	5	t	2026-02-08 03:10:03.430269+00	Sebastian Santa	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c3VhcmlvIjoiMyIsInVzZXJuYW1lIjoic3NhbnRhIiwicm9sIjoiQVNFU09SIiwiaWF0IjoxNzcxMDA2MzY1LCJleHAiOjE3NzE2MTExNjV9.fpG63JvrfPz3p1LIJ9ZlIIftzxpc1OfB_TCo9NBhrzM
2	atamayo	CC	00000000	$2a$10$8/LtBMNogoN4A9ksqMtK0OdsZfGALqwKXbdSfHSryLGYcUal4rAq6	ASESOR	5	t	2026-02-08 02:30:56.529761+00	Ana Maria Tamayo	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c3VhcmlvIjoiMiIsInVzZXJuYW1lIjoiYXRhbWF5byIsInJvbCI6IkFTRVNPUiIsImlhdCI6MTc3MTI5NTk3NywiZXhwIjoxNzcxOTAwNzc3fQ.tQ_rveqUheSDqlp86OvCiwy_eqD3CzHujp5bNQy3Cis
\.


--
-- Name: adjuntos_id_adjunto_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.adjuntos_id_adjunto_seq', 1, false);


--
-- Name: agentes_en_linea_id_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.agentes_en_linea_id_seq', 1, false);


--
-- Name: asignaciones_id_asignacion_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.asignaciones_id_asignacion_seq', 10, true);


--
-- Name: contactos_id_contacto_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.contactos_id_contacto_seq', 10, true);


--
-- Name: conversaciones_id_conversacion_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.conversaciones_id_conversacion_seq', 10, true);


--
-- Name: empresas_id_empresa_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.empresas_id_empresa_seq', 10, true);


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.knex_migrations_id_seq', 8, true);


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.knex_migrations_lock_index_seq', 1, true);


--
-- Name: llamadas_id_llamada_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.llamadas_id_llamada_seq', 1, false);


--
-- Name: mensajes_id_mensaje_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.mensajes_id_mensaje_seq', 85, true);


--
-- Name: mensajes_salas_id_mensaje_sala_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.mensajes_salas_id_mensaje_sala_seq', 1, false);


--
-- Name: participantes_llamada_id_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.participantes_llamada_id_seq', 1, false);


--
-- Name: preguntas_frecuentes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.preguntas_frecuentes_id_seq', 4, true);


--
-- Name: salas_id_sala_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.salas_id_sala_seq', 1, false);


--
-- Name: seguimiento_atenciones_id_seguimiento_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.seguimiento_atenciones_id_seguimiento_seq', 1, false);


--
-- Name: temas_preguntas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.temas_preguntas_id_seq', 5, true);


--
-- Name: usuarios_soporte_id_usuario_seq; Type: SEQUENCE SET; Schema: public; Owner: chatbotcrm
--

SELECT pg_catalog.setval('public.usuarios_soporte_id_usuario_seq', 4, true);


--
-- Name: adjuntos adjuntos_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.adjuntos
    ADD CONSTRAINT adjuntos_pkey PRIMARY KEY (id_adjunto);


--
-- Name: agentes_en_linea agentes_en_linea_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.agentes_en_linea
    ADD CONSTRAINT agentes_en_linea_pkey PRIMARY KEY (id);


--
-- Name: asignaciones asignaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.asignaciones
    ADD CONSTRAINT asignaciones_pkey PRIMARY KEY (id_asignacion);


--
-- Name: contactos contactos_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_pkey PRIMARY KEY (id_contacto);


--
-- Name: conversaciones conversaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_pkey PRIMARY KEY (id_conversacion);


--
-- Name: empresas empresas_nit_unique; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_nit_unique UNIQUE (nit);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id_empresa);


--
-- Name: knex_migrations_lock knex_migrations_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.knex_migrations_lock
    ADD CONSTRAINT knex_migrations_lock_pkey PRIMARY KEY (index);


--
-- Name: knex_migrations knex_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.knex_migrations
    ADD CONSTRAINT knex_migrations_pkey PRIMARY KEY (id);


--
-- Name: llamadas llamadas_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.llamadas
    ADD CONSTRAINT llamadas_pkey PRIMARY KEY (id_llamada);


--
-- Name: mensajes mensajes_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_pkey PRIMARY KEY (id_mensaje);


--
-- Name: mensajes_salas mensajes_salas_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.mensajes_salas
    ADD CONSTRAINT mensajes_salas_pkey PRIMARY KEY (id_mensaje_sala);


--
-- Name: miembros_salas miembros_salas_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.miembros_salas
    ADD CONSTRAINT miembros_salas_pkey PRIMARY KEY (sala_id, usuario_id);


--
-- Name: participantes_llamada participantes_llamada_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.participantes_llamada
    ADD CONSTRAINT participantes_llamada_pkey PRIMARY KEY (id);


--
-- Name: preguntas_frecuentes preguntas_frecuentes_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.preguntas_frecuentes
    ADD CONSTRAINT preguntas_frecuentes_pkey PRIMARY KEY (id);


--
-- Name: salas salas_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_pkey PRIMARY KEY (id_sala);


--
-- Name: seguimiento_atenciones seguimiento_atenciones_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.seguimiento_atenciones
    ADD CONSTRAINT seguimiento_atenciones_pkey PRIMARY KEY (id_seguimiento);


--
-- Name: temas_preguntas temas_preguntas_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.temas_preguntas
    ADD CONSTRAINT temas_preguntas_pkey PRIMARY KEY (id);


--
-- Name: usuarios_soporte usuarios_soporte_pkey; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.usuarios_soporte
    ADD CONSTRAINT usuarios_soporte_pkey PRIMARY KEY (id_usuario);


--
-- Name: usuarios_soporte usuarios_soporte_username_unique; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.usuarios_soporte
    ADD CONSTRAINT usuarios_soporte_username_unique UNIQUE (username);


--
-- Name: agentes_en_linea ux_agentes_en_linea; Type: CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.agentes_en_linea
    ADD CONSTRAINT ux_agentes_en_linea UNIQUE (empresa_id, usuario_id);


--
-- Name: idx_preguntas_orden; Type: INDEX; Schema: public; Owner: chatbotcrm
--

CREATE INDEX idx_preguntas_orden ON public.preguntas_frecuentes USING btree (orden);


--
-- Name: idx_preguntas_tema; Type: INDEX; Schema: public; Owner: chatbotcrm
--

CREATE INDEX idx_preguntas_tema ON public.preguntas_frecuentes USING btree (tema_id);


--
-- Name: idx_temas_orden; Type: INDEX; Schema: public; Owner: chatbotcrm
--

CREATE INDEX idx_temas_orden ON public.temas_preguntas USING btree (orden);


--
-- Name: ix_adjuntos_mensaje; Type: INDEX; Schema: public; Owner: chatbotcrm
--

CREATE INDEX ix_adjuntos_mensaje ON public.adjuntos USING btree (mensaje_id);


--
-- Name: ix_conversaciones_cola; Type: INDEX; Schema: public; Owner: chatbotcrm
--

CREATE INDEX ix_conversaciones_cola ON public.conversaciones USING btree (empresa_id, estado, creada_en);


--
-- Name: ix_mensajes_conversacion_fecha; Type: INDEX; Schema: public; Owner: chatbotcrm
--

CREATE INDEX ix_mensajes_conversacion_fecha ON public.mensajes USING btree (conversacion_id, creado_en);


--
-- Name: ix_seguimiento_empresa_usuario_fecha; Type: INDEX; Schema: public; Owner: chatbotcrm
--

CREATE INDEX ix_seguimiento_empresa_usuario_fecha ON public.seguimiento_atenciones USING btree (empresa_id, usuario_id, creado_en);


--
-- Name: uq_conversacion_activa_por_contacto; Type: INDEX; Schema: public; Owner: chatbotcrm
--

CREATE UNIQUE INDEX uq_conversacion_activa_por_contacto ON public.conversaciones USING btree (empresa_id, contacto_id) WHERE ((estado)::text = ANY ((ARRAY['EN_COLA'::character varying, 'ASIGNADA'::character varying])::text[]));


--
-- Name: ux_contactos_empresa_documento; Type: INDEX; Schema: public; Owner: chatbotcrm
--

CREATE UNIQUE INDEX ux_contactos_empresa_documento ON public.contactos USING btree (empresa_id, documento) WHERE (documento IS NOT NULL);


--
-- Name: adjuntos adjuntos_conversacion_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.adjuntos
    ADD CONSTRAINT adjuntos_conversacion_id_foreign FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id_conversacion) ON DELETE CASCADE;


--
-- Name: adjuntos adjuntos_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.adjuntos
    ADD CONSTRAINT adjuntos_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;


--
-- Name: adjuntos adjuntos_mensaje_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.adjuntos
    ADD CONSTRAINT adjuntos_mensaje_id_foreign FOREIGN KEY (mensaje_id) REFERENCES public.mensajes(id_mensaje) ON DELETE SET NULL;


--
-- Name: adjuntos adjuntos_subido_por_contacto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.adjuntos
    ADD CONSTRAINT adjuntos_subido_por_contacto_id_foreign FOREIGN KEY (subido_por_contacto_id) REFERENCES public.contactos(id_contacto) ON DELETE SET NULL;


--
-- Name: adjuntos adjuntos_subido_por_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.adjuntos
    ADD CONSTRAINT adjuntos_subido_por_usuario_id_foreign FOREIGN KEY (subido_por_usuario_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE SET NULL;


--
-- Name: agentes_en_linea agentes_en_linea_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.agentes_en_linea
    ADD CONSTRAINT agentes_en_linea_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;


--
-- Name: agentes_en_linea agentes_en_linea_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.agentes_en_linea
    ADD CONSTRAINT agentes_en_linea_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE CASCADE;


--
-- Name: asignaciones asignaciones_conversacion_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.asignaciones
    ADD CONSTRAINT asignaciones_conversacion_id_foreign FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id_conversacion) ON DELETE CASCADE;


--
-- Name: asignaciones asignaciones_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.asignaciones
    ADD CONSTRAINT asignaciones_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;


--
-- Name: asignaciones asignaciones_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.asignaciones
    ADD CONSTRAINT asignaciones_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE CASCADE;


--
-- Name: contactos contactos_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;


--
-- Name: conversaciones conversaciones_asignada_a_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_asignada_a_usuario_id_foreign FOREIGN KEY (asignada_a_usuario_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE SET NULL;


--
-- Name: conversaciones conversaciones_contacto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_contacto_id_foreign FOREIGN KEY (contacto_id) REFERENCES public.contactos(id_contacto) ON DELETE CASCADE;


--
-- Name: conversaciones conversaciones_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;


--
-- Name: llamadas llamadas_agente_asignado_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.llamadas
    ADD CONSTRAINT llamadas_agente_asignado_id_foreign FOREIGN KEY (agente_asignado_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE SET NULL;


--
-- Name: llamadas llamadas_conversacion_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.llamadas
    ADD CONSTRAINT llamadas_conversacion_id_foreign FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id_conversacion) ON DELETE CASCADE;


--
-- Name: llamadas llamadas_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.llamadas
    ADD CONSTRAINT llamadas_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;


--
-- Name: llamadas llamadas_iniciada_por_contacto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.llamadas
    ADD CONSTRAINT llamadas_iniciada_por_contacto_id_foreign FOREIGN KEY (iniciada_por_contacto_id) REFERENCES public.contactos(id_contacto) ON DELETE SET NULL;


--
-- Name: llamadas llamadas_iniciada_por_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.llamadas
    ADD CONSTRAINT llamadas_iniciada_por_usuario_id_foreign FOREIGN KEY (iniciada_por_usuario_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE SET NULL;


--
-- Name: mensajes mensajes_contacto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_contacto_id_foreign FOREIGN KEY (contacto_id) REFERENCES public.contactos(id_contacto) ON DELETE SET NULL;


--
-- Name: mensajes mensajes_conversacion_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_conversacion_id_foreign FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id_conversacion) ON DELETE CASCADE;


--
-- Name: mensajes mensajes_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;


--
-- Name: mensajes_salas mensajes_salas_sala_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.mensajes_salas
    ADD CONSTRAINT mensajes_salas_sala_id_foreign FOREIGN KEY (sala_id) REFERENCES public.salas(id_sala) ON DELETE CASCADE;


--
-- Name: mensajes_salas mensajes_salas_usuario_envia_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.mensajes_salas
    ADD CONSTRAINT mensajes_salas_usuario_envia_id_foreign FOREIGN KEY (usuario_envia_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE CASCADE;


--
-- Name: mensajes mensajes_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE SET NULL;


--
-- Name: miembros_salas miembros_salas_sala_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.miembros_salas
    ADD CONSTRAINT miembros_salas_sala_id_foreign FOREIGN KEY (sala_id) REFERENCES public.salas(id_sala) ON DELETE CASCADE;


--
-- Name: miembros_salas miembros_salas_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.miembros_salas
    ADD CONSTRAINT miembros_salas_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE CASCADE;


--
-- Name: participantes_llamada participantes_llamada_contacto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.participantes_llamada
    ADD CONSTRAINT participantes_llamada_contacto_id_foreign FOREIGN KEY (contacto_id) REFERENCES public.contactos(id_contacto) ON DELETE SET NULL;


--
-- Name: participantes_llamada participantes_llamada_llamada_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.participantes_llamada
    ADD CONSTRAINT participantes_llamada_llamada_id_foreign FOREIGN KEY (llamada_id) REFERENCES public.llamadas(id_llamada) ON DELETE CASCADE;


--
-- Name: participantes_llamada participantes_llamada_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.participantes_llamada
    ADD CONSTRAINT participantes_llamada_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE SET NULL;


--
-- Name: preguntas_frecuentes preguntas_frecuentes_tema_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.preguntas_frecuentes
    ADD CONSTRAINT preguntas_frecuentes_tema_id_foreign FOREIGN KEY (tema_id) REFERENCES public.temas_preguntas(id) ON DELETE CASCADE;


--
-- Name: salas salas_creado_por_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_creado_por_usuario_id_foreign FOREIGN KEY (creado_por_usuario_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE CASCADE;


--
-- Name: salas salas_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;


--
-- Name: seguimiento_atenciones seguimiento_atenciones_contacto_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.seguimiento_atenciones
    ADD CONSTRAINT seguimiento_atenciones_contacto_id_foreign FOREIGN KEY (contacto_id) REFERENCES public.contactos(id_contacto) ON DELETE CASCADE;


--
-- Name: seguimiento_atenciones seguimiento_atenciones_conversacion_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.seguimiento_atenciones
    ADD CONSTRAINT seguimiento_atenciones_conversacion_id_foreign FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id_conversacion) ON DELETE CASCADE;


--
-- Name: seguimiento_atenciones seguimiento_atenciones_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.seguimiento_atenciones
    ADD CONSTRAINT seguimiento_atenciones_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id_empresa) ON DELETE CASCADE;


--
-- Name: seguimiento_atenciones seguimiento_atenciones_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: chatbotcrm
--

ALTER TABLE ONLY public.seguimiento_atenciones
    ADD CONSTRAINT seguimiento_atenciones_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES public.usuarios_soporte(id_usuario) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict b31sxJparRfoQinOZcC3KYraVlWAgd1d8uhtBCpGKhR710S2yaMrsdOT0NXtPJH

