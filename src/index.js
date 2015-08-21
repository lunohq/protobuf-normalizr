const isEntity = (obj, key=null) => {
    if (
        (obj && obj.hasOwnProperty('id') && obj.id !== null) ||
        (key !== null)
    ) {
        return true;

    }
    return false;
}

const getEntityKey = (entity) => {
    return entity.$type.name.toLowerCase();
}

const getEntityId = (entity, key=null) => {
    return key ? key : entity.get('id');
}

const normalizeField = (field, protobuf, protobufs, normalizations, key=null) => {
    let value = protobuf.get(field.name)
    if (!(field.repeated || isEntity(value, key))) {
        return;
    }

    let entityKey = getEntityKey(protobuf);
    let entityId = getEntityId(protobuf, key);
    if (!normalizations[entityKey]) {
        normalizations[entityKey] = {};
    }

    if (!normalizations[entityKey][entityId]) {
        normalizations[entityKey][entityId] = {};
    }

    let stored = normalizations[entityKey][entityId];
    if (field.repeated && value !== null) {
        if (!stored[field.name]) {
            stored[field.name] = [];
        }
        value.map((childProtobuf) => {
            stored[field.name].push(childProtobuf.id);
            visit(childProtobuf, protobufs, normalizations);
        })
        protobuf.set(field.name, null);
    } else if (value !== null && isEntity(value)) {
        stored[field.name] = value.id;
        visit(value, protobufs, normalizations);
        protobuf.set(field.name, null);
    }
}

const visitProtobuf = (protobuf, protobufs, normalizations, key=null) => {
    protobuf.$type._fields.map((field) => {
        normalizeField(field, protobuf, protobufs, normalizations, key);
    });
    return protobuf;
}

const visitArray = (obj, protobufs, normalizations) => {
    const normalized = obj.map((childObj) => {
        return visit(childObj, protobufs, normalizations);
    })
    return normalized;
}

const visitEntity = (entity, protobufs, normalizations, key=null) => {
    const entityKey = getEntityKey(entity);
    const entityId = getEntityId(entity, key);

    if (!protobufs[entityKey]) {
        protobufs[entityKey] = {};
    }

    protobufs[entityKey][entityId] = entity;
    visitProtobuf(entity, protobufs, normalizations, key);
    return entityId;
}

const visit = (obj, protobufs, normalizations, key=null) => {
    if (obj.$type && isEntity(obj, key)) {
        return visitEntity(obj, protobufs, normalizations, key);
    } else if (obj.$type) {
        return visitProtobuf(obj, protobufs, normalizations);
    } else if (obj instanceof Array) {
        return visitArray(obj, protobufs, normalizations);
    }

    return obj;
}

const denormalizeProtobuf = (protobuf, entityKey, key, state) => {
    if (!state.normalizations[entityKey]) {
        return;
    }

    const fieldNames = protobuf.$type._fieldsByName;
    const normalizations = state.normalizations[entityKey][key];
    for (let field in normalizations) {
        const value = normalizations[field];
        const type = fieldNames[field].resolvedType.name.toLowerCase();
        if (value instanceof Array) {
            protobuf.set(field, []);
            value.map((id) => {
                protobuf[field].push(state.protobufs[type][id]);
            });
        } else {
            protobuf.set(field, state.protobufs[type][value]);
        }
    }
}

export const normalize = (obj, key=null) => {
    let protobufs = {};
    let normalizations = {};
    let result = visit(obj, protobufs, normalizations, key);
    return { protobufs, normalizations, result };
}

export const denormalize = (key, builder, state) => {
    const entityKey = getEntityKey(builder);
    if (!state.protobufs[entityKey]) {
        return;
    }
    const protobuf = state.protobufs[entityKey][key];
    denormalizeProtobuf(protobuf, entityKey, key, state)
    return protobuf;
}

export default normalize;