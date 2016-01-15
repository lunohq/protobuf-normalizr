'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports['default'] = normalize;
exports.denormalize = denormalize;
exports.getNormalizations = getNormalizations;
var isProtobuf = function isProtobuf(obj) {
    return obj && obj.$type;
};

var isEntity = function isEntity(obj) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    if (obj && obj.hasOwnProperty('id') && obj.id !== null || key !== null) {
        return true;
    }
    return false;
};

var getEntityKey = function getEntityKey(entity) {
    return entity.$type.fqn().toLowerCase();
};

var getEntityId = function getEntityId(entity) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    return key ? key : entity.get('id');
};

var normalizeField = function normalizeField(field, entity, entities, normalizations) {
    var key = arguments.length <= 4 || arguments[4] === undefined ? null : arguments[4];

    var value = entity.get(field.name);
    if (value === null || !(field.repeated && value.length && isEntity(value[0], key) || isEntity(value, key))) {
        return;
    }

    var entityKey = getEntityKey(entity);
    var entityId = getEntityId(entity, key);
    if (!normalizations[entityKey]) {
        normalizations[entityKey] = {};
    }

    if (!normalizations[entityKey][entityId]) {
        normalizations[entityKey][entityId] = {};
    }

    var stored = normalizations[entityKey][entityId];
    if (field.repeated) {
        if (!stored[field.name]) {
            stored[field.name] = [];
        }
        value.map(function (childProtobuf) {
            stored[field.name].push(childProtobuf.id);
            visit(childProtobuf, entities, normalizations);
        });
        entity.set(field.name, null);
    } else if (isEntity(value)) {
        stored[field.name] = value.id;
        visit(value, entities, normalizations);
        entity.set(field.name, null);
    }
};

var visitProtobuf = function visitProtobuf(entity, entities, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    entity.$type._fields.map(function (field) {
        normalizeField(field, entity, entities, normalizations, key);
    });
    return entity;
};

var visitArray = function visitArray(obj, entities, normalizations) {
    var normalized = obj.map(function (childObj) {
        return visit(childObj, entities, normalizations);
    });
    return normalized;
};

var visitEntity = function visitEntity(entity, entities, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    var entityKey = getEntityKey(entity);
    var entityId = getEntityId(entity, key);

    if (!entities[entityKey]) {
        entities[entityKey] = {};
    }

    entities[entityKey][entityId] = entity;
    visitProtobuf(entity, entities, normalizations, key);
    return entityId;
};

var visit = function visit(obj, entities, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    if (isProtobuf(obj) && isEntity(obj, key)) {
        return visitEntity(obj, entities, normalizations, key);
    } else if (isProtobuf(obj)) {
        return visitProtobuf(obj, entities, normalizations);
    } else if (obj instanceof Array) {
        return visitArray(obj, entities, normalizations);
    }

    return obj;
};

var denormalizeEntity = function denormalizeEntity(entity, entityKey, key, state) {
    var parent = arguments.length <= 4 || arguments[4] === undefined ? null : arguments[4];
    var validator = arguments.length <= 5 || arguments[5] === undefined ? null : arguments[5];

    // Create a copy of the entity which we'll denormalize. This ensures we're not inflating entities when
    // denormalizing.
    var denormalizedEntity = entity.$type.clazz.decode(entity.encode());
    if (!state.normalizations[entityKey]) {
        return denormalizedEntity;
    }

    var fieldNames = denormalizedEntity.$type._fieldsByName;
    var normalizations = state.normalizations[entityKey][key];

    var _loop = function (field) {
        var value = normalizations[field];
        var type = fieldNames[field].resolvedType.fqn().toLowerCase();
        // Prevent circular relationships
        if (type === parent) {
            return 'continue';
        }

        if (value instanceof Array) {
            denormalizedEntity.set(field, []);
            value.map(function (id) {
                var normalizedValue = state.entities[type][id];
                denormalizedEntity[field].push(denormalizeEntity(normalizedValue, type, id, state, parent = entityKey));
            });
        } else {
            var normalizedValue = state.entities[type][value];
            denormalizedEntity.set(field, denormalizeEntity(normalizedValue, type, value, state, parent = entityKey));
        }
    };

    for (var field in normalizations) {
        var _ret = _loop(field);

        if (_ret === 'continue') continue;
    }

    if (validator && !validator(denormalizedEntity, entityKey, key)) {
        return null;
    }

    return denormalizedEntity;
};

function normalize(obj) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    var entities = {};
    var normalizations = {};
    var result = visit(obj, entities, normalizations, key);
    return { entities: entities, normalizations: normalizations, result: result };
}

function denormalize(key, builder, state, validator) {
    var entityKey = getEntityKey(builder);
    if (!state.entities[entityKey]) {
        return;
    }
    if (Array.isArray(key)) {
        return key.map(function (id) {
            var entity = state.entities[entityKey][id];
            var denormalizedEntity = denormalizeEntity(entity, entityKey, id, state, undefined, validator);
            if (validator && !validator(denormalizedEntity, entityKey, key)) {
                return;
            } else {
                return entity;
            }
        });
    } else {
        var entity = state.entities[entityKey][key];
        return denormalizeEntity(entity, entityKey, key, state, undefined, validator);
    }
}

function getNormalizations(normalizationsKey, key, builder, state) {
    var entityKey = getEntityKey(builder);
    if (!state.normalizations[entityKey]) {
        return;
    }
    var normalizations = state.normalizations[entityKey][key];
    if (!normalizations) {
        return;
    }
    return normalizations[normalizationsKey];
}