import Protobuf from 'protobufjs';

const isProtobuf = (obj) => obj && obj.$type instanceof Protobuf.Reflect.Message;

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
    return entity.$type.fqn().toLowerCase();
}

const getEntityId = (entity, key=null) => {
    return key ? key : entity.get('id');
}

const normalizeField = (field, entity, entities, normalizations, key=null) => {
    let value = entity.get(field.name)
    if (value === null || !(field.repeated && value.length || isEntity(value, key))) {
        return;
    }

    let entityKey = getEntityKey(entity);
    let entityId = getEntityId(entity, key);
    if (!normalizations[entityKey]) {
        normalizations[entityKey] = {};
    }

    if (!normalizations[entityKey][entityId]) {
        normalizations[entityKey][entityId] = {};
    }

    let stored = normalizations[entityKey][entityId];
    if (field.repeated) {
        if (!stored[field.name]) {
            stored[field.name] = [];
        }
        value.map((childProtobuf) => {
            stored[field.name].push(childProtobuf.id);
            visit(childProtobuf, entities, normalizations);
        })
        entity.set(field.name, null);
    } else if (isEntity(value)) {
        stored[field.name] = value.id;
        visit(value, entities, normalizations);
        entity.set(field.name, null);
    }
}

const visitProtobuf = (entity, entities, normalizations, key=null) => {
    entity.$type.getChildren(Protobuf.Reflect.Message.Field).map((field) => {
        normalizeField(field, entity, entities, normalizations, key);
    });
    return entity;
}

const visitArray = (obj, entities, normalizations) => {
    const normalized = obj.map((childObj) => {
        return visit(childObj, entities, normalizations);
    })
    return normalized;
}

const visitEntity = (entity, entities, normalizations, key=null) => {
    const entityKey = getEntityKey(entity);
    const entityId = getEntityId(entity, key);

    if (!entities[entityKey]) {
        entities[entityKey] = {};
    }

    entities[entityKey][entityId] = entity;
    visitProtobuf(entity, entities, normalizations, key);
    return entityId;
}

const visit = (obj, entities, normalizations, key=null) => {
    if (isProtobuf(obj) && isEntity(obj, key)) {
        return visitEntity(obj, entities, normalizations, key);
    } else if (isProtobuf(obj)) {
        return visitProtobuf(obj, entities, normalizations);
    } else if (obj instanceof Array) {
        return visitArray(obj, entities, normalizations);
    }

    return obj;
}

const denormalizeEntity = (entity, entityKey, key, state) => {
    if (!state.normalizations[entityKey]) {
        return;
    }

    const fieldNames = entity.$type._fieldsByName;
    const normalizations = state.normalizations[entityKey][key];
    for (let field in normalizations) {
        const value = normalizations[field];
        const type = fieldNames[field].resolvedType.fqn().toLowerCase();
        if (value instanceof Array) {
            entity.set(field, []);
            value.map((id) => {
                entity[field].push(state.entities[type][id]);
            });
        } else {
            entity.set(field, state.entities[type][value]);
        }
    }
}

export const normalize = (obj, key=null) => {
    let entities = {};
    let normalizations = {};
    let result = visit(obj, entities, normalizations, key);
    return { entities, normalizations, result };
}

export const denormalize = (key, builder, state) => {
    const entityKey = getEntityKey(builder);
    if (!state.entities[entityKey]) {
        return;
    }
    const entity = state.entities[entityKey][key];
    denormalizeEntity(entity, entityKey, key, state)
    return entity;
}

export default normalize;