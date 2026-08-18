process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
process.env.FRONTEND_URL ||= 'https://comuva.com';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, DataTypes } = require('sequelize');

const {
  hashInviteToken,
} = require('../src/utils/invitacionTokens');

const CONTROLLER_PATH = require.resolve('../src/controllers/invitacionesController');
const MODELS_PATH = require.resolve('../src/models');
const PERMISSION_PATH = require.resolve('../src/middleware/allowGestionarInvitacionesComunidad');
const ROLES_PATH = require.resolve('../src/utils/comunidadRoles');

const createResponse = () => {
  const response = { statusCode: 200, body: null, headers: {} };
  const res = {
    set(name, value) {
      response.headers[name] = value;
      return this;
    },
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    },
  };

  return { response, res };
};

const createHarness = ({
  permissionAllowed = true,
  permissionStatus = 403,
  permissionMessage = 'Você não tem permissão para administrar convites desta comunidade',
} = {}) => {
  const calls = [];
  const now = new Date('2026-08-17T00:00:00.000Z');
  let nextInviteId = 1;
  let nextMembershipId = 1;
  const invites = [];
  const users = new Map();
  const communities = new Map();
  const memberships = [];
  const ownedCommunityIdsByUser = new Map();

  const normalizeWhereValue = (value) => (
    value && typeof value === 'object' && Object.hasOwn(value, 'val')
      ? value.val
      : value
  );

  const matchesWhere = (row, where = {}) => {
    return Object.entries(where).every(([key, value]) => {
      const expected = normalizeWhereValue(value);
      return row[key] === expected;
    });
  };

  const createInviteInstance = (row) => ({
    ...row,
    get comunidad() {
      return row.comunidad;
    },
    set comunidad(value) {
      row.comunidad = value;
    },
    update: async (values) => {
      calls.push(['invite:update', row.id, values]);
      Object.assign(row, values, { updated_at: now });
      Object.assign(this, row);
      return createInviteInstance(row);
    },
  });

  const createMembershipInstance = (row) => ({
    ...row,
    update: async (values) => {
      calls.push(['membership:update', row.user_id, row.comunidad_id, values]);
      Object.assign(row, values, { updated_at: now });
      return createMembershipInstance(row);
    },
  });

  const createUserInstance = (row) => ({
    ...row,
    update: async (values) => {
      calls.push(['user:update', row.id, values]);
      Object.assign(row, values);
      return createUserInstance(row);
    },
  });

  const ComunidadInvitacion = {
    create: async (values) => {
      calls.push(['invite:create', values]);
      const row = {
        id: nextInviteId,
        created_at: now,
        updated_at: now,
        revoked_at: null,
        revoked_by_user_id: null,
        last_used_at: null,
        ...values,
      };
      nextInviteId += 1;
      invites.push(row);
      return createInviteInstance(row);
    },
    findAll: async (options = {}) => {
      calls.push(['invite:findAll', options]);
      return invites
        .filter((invite) => matchesWhere(invite, options.where))
        .sort((a, b) => a.id - b.id)
        .map(createInviteInstance);
    },
    findByPk: async (id, options = {}) => {
      calls.push(['invite:findByPk', id, options]);
      const row = invites.find((invite) => Number(invite.id) === Number(id));
      return row ? createInviteInstance(row) : null;
    },
    findOne: async (options = {}) => {
      calls.push(['invite:findOne', options]);
      const row = invites.find((invite) => matchesWhere(invite, options.where));
      if (!row) return null;

      if (options.include) {
        const comunidad = communities.get(row.comunidad_id);
        const instance = createInviteInstance(row);
        instance.comunidad = comunidad ? { ...comunidad } : null;
        return instance;
      }

      return createInviteInstance(row);
    },
  };

  const Comunidad = {
    findByPk: async (id, options = {}) => {
      calls.push(['community:findByPk', id, options]);
      const row = communities.get(Number(id));
      return row ? { ...row } : null;
    },
    findAll: async (options = {}) => {
      calls.push(['community:findAll', options]);
      const id = options.where?.id || options.where?.$or?.[0]?.id;
      const rows = [...communities.values()].filter((community) => (
        !id || Number(community.id) === Number(id)
      ));
      return rows.map((row) => ({ ...row }));
    },
  };

  const User = {
    findByPk: async (id, options = {}) => {
      calls.push(['user:findByPk', id, options]);
      const row = users.get(Number(id));
      return row ? createUserInstance(row) : null;
    },
  };

  const ComunidadMiembro = {
    findOne: async (options = {}) => {
      calls.push(['membership:findOne', options]);
      const row = memberships.find((membership) => matchesWhere(membership, options.where));
      return row ? createMembershipInstance(row) : null;
    },
  };

  const sequelize = {
    transaction: async (callback) => {
      const transaction = { LOCK: { UPDATE: 'UPDATE' } };
      calls.push(['transaction:start']);
      const result = await callback(transaction);
      calls.push(['transaction:commit']);
      return result;
    },
    query: async (_sql, options = {}) => {
      calls.push(['sequelize:query', options.replacements]);
      const { userId, comunidadId } = options.replacements;
      const existing = memberships.find((membership) => (
        Number(membership.user_id) === Number(userId) &&
        Number(membership.comunidad_id) === Number(comunidadId)
      ));

      if (existing) return [];

      const row = {
        id: nextMembershipId,
        user_id: Number(userId),
        comunidad_id: Number(comunidadId),
        rol_comunidad: 'miembro',
        estado: 'activo',
        es_principal: true,
        created_at: now,
        updated_at: now,
      };
      nextMembershipId += 1;
      memberships.push(row);
      return [{ ...row }];
    },
  };

  const lockUserCommunityEligibilityTx = async ({ userId, targetComunidadId, transaction }) => {
    calls.push(['eligibility:lock', { userId, targetComunidadId, transaction }]);
    const user = users.get(Number(userId));
    const targetCommunity = communities.get(Number(targetComunidadId)) || null;
    const activeMemberships = memberships
      .filter((membership) => (
        Number(membership.user_id) === Number(userId) &&
        membership.estado === 'activo'
      ))
      .map(createMembershipInstance);
    const targetActiveMembership = activeMemberships.find((membership) => (
      Number(membership.comunidad_id) === Number(targetComunidadId)
    )) || null;
    const otherActiveMemberships = activeMemberships.filter((membership) => (
      Number(membership.comunidad_id) !== Number(targetComunidadId)
    ));
    const ownedCommunityIds = ownedCommunityIdsByUser.get(Number(userId)) || [];
    const ownsTarget = ownedCommunityIds.includes(Number(targetComunidadId));
    const otherOwnedCommunities = ownedCommunityIds
      .filter((id) => id !== Number(targetComunidadId))
      .map((id) => communities.get(id))
      .filter(Boolean);
    const assignedComunidadId = user?.comunidad_id || null;
    const hasOtherRelation = Boolean(
      (assignedComunidadId && Number(assignedComunidadId) !== Number(targetComunidadId)) ||
      otherActiveMemberships.length > 0 ||
      otherOwnedCommunities.length > 0
    );

    return {
      user: user ? createUserInstance(user) : null,
      targetCommunity,
      assignedComunidadId,
      activeMemberships,
      ownedCommunities: ownedCommunityIds.map((id) => communities.get(id)).filter(Boolean),
      targetActiveMembership,
      ownsTarget,
      assignedToTarget: Number(assignedComunidadId) === Number(targetComunidadId),
      otherActiveMemberships,
      otherOwnedCommunities,
      hasOtherRelation,
      hasAnyRelation: Boolean(assignedComunidadId || activeMemberships.length || ownedCommunityIds.length),
      eligible: !assignedComunidadId && activeMemberships.length === 0 && ownedCommunityIds.length === 0,
    };
  };

  delete require.cache[CONTROLLER_PATH];
  require.cache[MODELS_PATH] = {
    id: MODELS_PATH,
    filename: MODELS_PATH,
    loaded: true,
    exports: {
      ComunidadInvitacion,
      ComunidadMiembro,
      Comunidad,
      User,
      sequelize,
    },
  };
  require.cache[PERMISSION_PATH] = {
    id: PERMISSION_PATH,
    filename: PERMISSION_PATH,
    loaded: true,
    exports: {
      resolveGestionInvitacionesComunidad: async ({ actorId, comunidadId }) => {
        calls.push(['permission:resolve', { actorId, comunidadId }]);
        const actor = users.get(Number(actorId));
        const comunidad = communities.get(Number(comunidadId));
        if (!permissionAllowed) {
          return {
            permitido: false,
            status: permissionStatus,
            message: permissionMessage,
            actor,
            comunidad,
          };
        }
        return {
          permitido: true,
          status: 200,
          scope: 'admin_basic',
          actor,
          comunidad,
        };
      },
    },
  };
  require.cache[ROLES_PATH] = {
    id: ROLES_PATH,
    filename: ROLES_PATH,
    loaded: true,
    exports: { lockUserCommunityEligibilityTx },
  };

  const controller = require(CONTROLLER_PATH);

  const addCommunity = (values = {}) => {
    const row = {
      id: values.id ?? 10,
      nombre_comunidad: values.nombre_comunidad || 'Comunidade Central',
      activa: values.activa ?? true,
      owner_user_id: values.owner_user_id ?? 1,
      ciudad: values.ciudad || 'São Paulo',
      pais: values.pais || 'BR',
      ...values,
    };
    communities.set(Number(row.id), row);
    return row;
  };

  const addUser = (values = {}) => {
    const row = {
      id: values.id ?? 1,
      rol_global: values.rol_global || 'miembro',
      comunidad_id: values.comunidad_id ?? null,
      ...values,
    };
    users.set(Number(row.id), row);
    return row;
  };

  const addInvite = (values = {}) => {
    const token = values.token || null;
    const row = {
      id: nextInviteId,
      token_hash: values.token_hash || (token ? hashInviteToken(token) : `hash-${nextInviteId}`),
      comunidad_id: values.comunidad_id ?? 10,
      created_by_user_id: values.created_by_user_id ?? 1,
      estado: values.estado || 'activa',
      expires_at: Object.hasOwn(values, 'expires_at') ? values.expires_at : null,
      max_usos: Object.hasOwn(values, 'max_usos') ? values.max_usos : null,
      usos_actuales: values.usos_actuales ?? 0,
      created_at: values.created_at || now,
      updated_at: values.updated_at || now,
      revoked_at: values.revoked_at ?? null,
      revoked_by_user_id: values.revoked_by_user_id ?? null,
      last_used_at: values.last_used_at ?? null,
    };
    nextInviteId += 1;
    invites.push(row);
    return row;
  };

  const addMembership = (values = {}) => {
    const row = {
      id: nextMembershipId,
      user_id: values.user_id,
      comunidad_id: values.comunidad_id,
      rol_comunidad: values.rol_comunidad || 'miembro',
      estado: values.estado || 'activo',
      es_principal: values.es_principal ?? true,
      created_at: now,
      updated_at: now,
    };
    nextMembershipId += 1;
    memberships.push(row);
    return row;
  };

  const ownCommunity = (userId, comunidadId) => {
    const owned = ownedCommunityIdsByUser.get(Number(userId)) || [];
    owned.push(Number(comunidadId));
    ownedCommunityIdsByUser.set(Number(userId), owned);
  };

  return {
    addCommunity,
    addInvite,
    addMembership,
    addUser,
    calls,
    communities,
    controller,
    invites,
    memberships,
    ownCommunity,
    users,
  };
};

test('cria nova invitación permanente e ilimitada por defecto', async () => {
  const harness = createHarness();
  const comunidad = harness.addCommunity();
  const actor = harness.addUser({ id: 1, comunidad_id: comunidad.id });
  const { response, res } = createResponse();

  await harness.controller.crearInvitacion({
    comunidad,
    actor,
    body: {},
  }, res);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.max_usos, null);
  assert.equal(response.body.expires_at, null);
  assert.equal(response.body.estado, 'activa');
  assert.equal(response.body.usos_actuales, 0);
  assert.equal(response.body.url, `https://comuva.com/convite/${encodeURIComponent(response.body.token)}`);
  assert.equal(Object.hasOwn(response.body, 'token_hash'), false);
});

test('ignora max_usos enviado por cliente y no crea invitación limitada', async () => {
  const harness = createHarness();
  const comunidad = harness.addCommunity();
  const actor = harness.addUser({ id: 1, comunidad_id: comunidad.id });
  const { response, res } = createResponse();

  await harness.controller.crearInvitacion({
    comunidad,
    actor,
    body: { max_usos: 1 },
  }, res);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.max_usos, null);
  assert.equal(harness.invites[0].max_usos, null);
});

test('ignora expires_at enviado por cliente y no crea invitación temporal', async () => {
  const harness = createHarness();
  const comunidad = harness.addCommunity();
  const actor = harness.addUser({ id: 1, comunidad_id: comunidad.id });
  const { response, res } = createResponse();

  await harness.controller.crearInvitacion({
    comunidad,
    actor,
    body: { expires_at: '2026-08-18T00:00:00Z' },
  }, res);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.expires_at, null);
  assert.equal(harness.invites[0].expires_at, null);
});

test('validar invitación permanente retorna válida sin fecha', async () => {
  const harness = createHarness();
  harness.addCommunity();
  const invite = harness.addInvite({ token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
  const { response, res } = createResponse();

  await harness.controller.validarInvitacion({
    params: { token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  }, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.valid, true);
  assert.equal(response.body.expires_at, null);
  assert.equal(response.body.comunidad.nombre, 'Comunidade Central');
  assert.equal(invite.estado, 'activa');
});

test('primeira aceitação cria membresia e incrementa usos_actuales', async () => {
  const harness = createHarness();
  harness.addCommunity();
  harness.addUser({ id: 2 });
  const invite = harness.addInvite({ token: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' });
  const { response, res } = createResponse();

  await harness.controller.aceptarInvitacion({
    params: { token: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    user: { id: 2 },
  }, res);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.accepted, true);
  assert.equal(response.body.already_member, false);
  assert.equal(harness.memberships.length, 1);
  assert.equal(invite.usos_actuales, 1);
  assert.equal(invite.estado, 'activa');
});

test('segunda pessoa distinta aceita invitación ilimitada e ela segue ativa', async () => {
  const harness = createHarness();
  harness.addCommunity();
  harness.addUser({ id: 2 });
  harness.addUser({ id: 3 });
  const invite = harness.addInvite({ token: 'ccccccccccccccccccccccccccccccccccccccccccc' });

  const first = createResponse();
  await harness.controller.aceptarInvitacion({
    params: { token: 'ccccccccccccccccccccccccccccccccccccccccccc' },
    user: { id: 2 },
  }, first.res);

  const second = createResponse();
  await harness.controller.aceptarInvitacion({
    params: { token: 'ccccccccccccccccccccccccccccccccccccccccccc' },
    user: { id: 3 },
  }, second.res);

  assert.equal(first.response.statusCode, 201);
  assert.equal(second.response.statusCode, 201);
  assert.equal(harness.memberships.length, 2);
  assert.equal(invite.usos_actuales, 2);
  assert.equal(invite.estado, 'activa');
});

test('invitación ilimitada não se esgota mesmo acima de 100 usos', async () => {
  const harness = createHarness();
  harness.addCommunity();
  harness.addUser({ id: 2 });
  const invite = harness.addInvite({
    token: 'ddddddddddddddddddddddddddddddddddddddddddd',
    usos_actuales: 100,
    max_usos: null,
  });
  const { response, res } = createResponse();

  await harness.controller.aceptarInvitacion({
    params: { token: 'ddddddddddddddddddddddddddddddddddddddddddd' },
    user: { id: 2 },
  }, res);

  assert.equal(response.statusCode, 201);
  assert.equal(invite.usos_actuales, 101);
  assert.equal(invite.estado, 'activa');
});

test('usuário já membro é idempotente e não incrementa uso', async () => {
  const harness = createHarness();
  harness.addCommunity();
  harness.addUser({ id: 2, comunidad_id: 10 });
  harness.addMembership({ user_id: 2, comunidad_id: 10 });
  const invite = harness.addInvite({
    token: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    usos_actuales: 7,
  });
  const { response, res } = createResponse();

  await harness.controller.aceptarInvitacion({
    params: { token: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
    user: { id: 2 },
  }, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.already_member, true);
  assert.equal(harness.memberships.length, 1);
  assert.equal(invite.usos_actuales, 7);
});

test('revogação faz token deixar de validar e aceitar', async () => {
  const harness = createHarness();
  harness.addCommunity();
  harness.addUser({ id: 1, comunidad_id: 10 });
  harness.addUser({ id: 2 });
  const invite = harness.addInvite({ token: 'fffffffffffffffffffffffffffffffffffffffffff' });

  const revoke = createResponse();
  await harness.controller.revocarInvitacion({
    params: { id: invite.id },
    user: { id: 1 },
  }, revoke.res);

  const validation = createResponse();
  await harness.controller.validarInvitacion({
    params: { token: 'fffffffffffffffffffffffffffffffffffffffffff' },
  }, validation.res);

  const acceptance = createResponse();
  await harness.controller.aceptarInvitacion({
    params: { token: 'fffffffffffffffffffffffffffffffffffffffffff' },
    user: { id: 2 },
  }, acceptance.res);

  assert.equal(revoke.response.statusCode, 200);
  assert.equal(invite.estado, 'revocada');
  assert.ok(invite.revoked_at);
  assert.equal(validation.response.body.valid, false);
  assert.equal(acceptance.response.statusCode, 404);
  assert.equal(acceptance.response.body.accepted, false);
});

test('invitación histórica limitada segue respeitando max_usos', async () => {
  const harness = createHarness();
  harness.addCommunity();
  harness.addUser({ id: 2 });
  const invite = harness.addInvite({
    token: 'ggggggggggggggggggggggggggggggggggggggggggg',
    max_usos: 2,
    usos_actuales: 1,
  });
  const { response, res } = createResponse();

  await harness.controller.aceptarInvitacion({
    params: { token: 'ggggggggggggggggggggggggggggggggggggggggggg' },
    user: { id: 2 },
  }, res);

  assert.equal(response.statusCode, 201);
  assert.equal(invite.usos_actuales, 2);
  assert.equal(invite.estado, 'agotada');
});

test('invitación histórica com expires_at vencido expira', async () => {
  const harness = createHarness();
  harness.addCommunity();
  harness.addInvite({
    token: 'hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
    expires_at: new Date('2026-08-16T00:00:00.000Z'),
    max_usos: 1,
  });
  const { response, res } = createResponse();

  await harness.controller.validarInvitacion({
    params: { token: 'hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh' },
  }, res);

  assert.equal(response.body.valid, false);
});

test('invitación histórica agotada segue rejeitada', async () => {
  const harness = createHarness();
  harness.addCommunity();
  harness.addInvite({
    token: 'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
    estado: 'agotada',
    max_usos: 1,
    usos_actuales: 1,
  });
  const { response, res } = createResponse();

  await harness.controller.validarInvitacion({
    params: { token: 'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii' },
  }, res);

  assert.equal(response.body.valid, false);
});

test('duas gerações consecutivas revogam ativa anterior da mesma comunidade', async () => {
  const harness = createHarness();
  const comunidad = harness.addCommunity();
  const actor = harness.addUser({ id: 1, comunidad_id: comunidad.id });
  const first = createResponse();
  await harness.controller.crearInvitacion({ comunidad, actor, body: {} }, first.res);
  const firstInvite = harness.invites[0];

  const second = createResponse();
  await harness.controller.crearInvitacion({ comunidad, actor, body: {} }, second.res);
  const secondInvite = harness.invites[1];

  assert.equal(first.response.statusCode, 201);
  assert.equal(second.response.statusCode, 201);
  assert.equal(firstInvite.estado, 'revocada');
  assert.ok(firstInvite.revoked_at);
  assert.equal(firstInvite.revoked_by_user_id, actor.id);
  assert.equal(secondInvite.estado, 'activa');
  assert.equal(harness.invites.filter((invite) => (
    invite.comunidad_id === comunidad.id && invite.estado === 'activa'
  )).length, 1);
});

test('geração não revoga convites agotados ou de outra comunidade', async () => {
  const harness = createHarness();
  const comunidad = harness.addCommunity({ id: 10 });
  harness.addCommunity({ id: 20 });
  const actor = harness.addUser({ id: 1, comunidad_id: comunidad.id });
  const exhausted = harness.addInvite({ comunidad_id: 10, estado: 'agotada', max_usos: 1, usos_actuales: 1 });
  const otherCommunityActive = harness.addInvite({ comunidad_id: 20, estado: 'activa' });
  const { response, res } = createResponse();

  await harness.controller.crearInvitacion({ comunidad, actor, body: {} }, res);

  assert.equal(response.statusCode, 201);
  assert.equal(exhausted.estado, 'agotada');
  assert.equal(otherCommunityActive.estado, 'activa');
});

test('autorização de revogação não é ampliada', async () => {
  const harness = createHarness({ permissionAllowed: false });
  harness.addCommunity();
  harness.addUser({ id: 1, comunidad_id: 10 });
  const invite = harness.addInvite();
  const { response, res } = createResponse();

  await harness.controller.revocarInvitacion({
    params: { id: invite.id },
    user: { id: 1 },
  }, res);

  assert.equal(response.statusCode, 403);
  assert.equal(invite.estado, 'activa');
});

test('geração usa transação, lock da comunidade e lock dos convites ativos', async () => {
  const harness = createHarness();
  const comunidad = harness.addCommunity();
  const actor = harness.addUser({ id: 1, comunidad_id: comunidad.id });
  const { res } = createResponse();

  await harness.controller.crearInvitacion({ comunidad, actor, body: {} }, res);

  const communityLock = harness.calls.find((call) => call[0] === 'community:findByPk');
  const activeInviteLock = harness.calls.find((call) => call[0] === 'invite:findAll');
  assert.equal(communityLock[2].lock, 'UPDATE');
  assert.equal(activeInviteLock[1].lock, 'UPDATE');
  assert.equal(harness.calls.some(([name]) => name === 'transaction:start'), true);
});

test('modelo permite max_usos null e valida faixa para valores definidos', async () => {
  const sequelize = new Sequelize('postgres://test:test@127.0.0.1:5432/test', {
    dialect: 'postgres',
    logging: false,
  });
  const ComunidadInvitacion = require('../src/models/ComunidadInvitacion')(sequelize, DataTypes);
  const baseValues = {
    token_hash: 'a'.repeat(64),
    comunidad_id: 10,
    created_by_user_id: 1,
    estado: 'activa',
    expires_at: null,
    usos_actuales: 0,
  };

  await assert.doesNotReject(
    ComunidadInvitacion.build({
      ...baseValues,
      max_usos: null,
    }).validate()
  );

  await assert.doesNotReject(
    ComunidadInvitacion.build({
      ...baseValues,
      max_usos: 100,
    }).validate()
  );

  await assert.rejects(
    ComunidadInvitacion.build({
      ...baseValues,
      max_usos: 101,
    }).validate(),
    /max_usos deve ser null ou um inteiro entre 1 e 100/
  );

  await sequelize.close();
});
