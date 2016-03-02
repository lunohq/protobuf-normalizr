'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports['default'] = normalize;
exports.denormalize = denormalize;
exports.getNormalizations = getNormalizations;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _immutable = require('immutable');

var _immutable2 = _interopRequireDefault(_immutable);

function isProtobuf(obj) {
    return obj && obj.$type;
}

function isEntity(obj) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    if (obj && obj.hasOwnProperty('id') && obj.id !== null || key !== null) {
        return true;
    }
    return false;
}

function hasEntityTypeInNormalizations(entityType, state) {
    if (_immutable2['default'].Map.isMap(state)) {
        return state.hasIn(['normalizations', entityType]);
    } else if (state) {
        return state.normalizations && !!state.normalizations[entityType];
    }
}

function hasEntityTypeInEntities(entityType, state) {
    if (_immutable2['default'].Map.isMap(state)) {
        return state.hasIn(['entities', entityType]);
    } else if (state) {
        return state.entities && !!state.entities[entityType];
    }
}

function getEntityFromState(entityType, key, state) {
    if (_immutable2['default'].Map.isMap(state)) {
        return state.getIn(['entities', entityType, key]);
    } else if (state) {
        return state.entities[entityType][key];
    }
}

function getNormalizationsFromState(entityType, key, state) {
    if (_immutable2['default'].Map.isMap(state)) {
        return state.getIn(['normalizations', entityType, key]);
    } else if (state) {
        return state.normalizations[entityType][key];
    }
}

function iterKeys(any) {
    if (_immutable2['default'].Iterable.isIterable(any)) {
        return any.keys();
    } else if (any) {
        return Object.keys(any);
    } else {
        return [];
    }
}

function iterValues(any) {
    if (_immutable2['default'].Iterable.isIterable(any)) {
        return any.values();
    } else if (any) {
        return Object.values(any);
    } else {
        return [];
    }
}

function getEntityKey(entity) {
    return entity.$type.fqn().toLowerCase();
}

function getEntityId(entity) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    return key ? key : entity.get('id');
}

function get(any, field) {
    if (_immutable2['default'].Map.isMap(any)) {
        return any.get(field);
    } else {
        return any[field];
    }
}

function normalizeField(field, entity, entities, normalizations) {
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
}

function visitProtobuf(entity, entities, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    entity.$type._fields.map(function (field) {
        normalizeField(field, entity, entities, normalizations, key);
    });
    return entity;
}

function visitArray(obj, entities, normalizations) {
    var normalized = obj.map(function (childObj) {
        return visit(childObj, entities, normalizations);
    });
    return normalized;
}

function visitEntity(entity, entities, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    var entityKey = getEntityKey(entity);
    var entityId = getEntityId(entity, key);

    if (!entities[entityKey]) {
        entities[entityKey] = {};
    }

    entities[entityKey][entityId] = entity;
    visitProtobuf(entity, entities, normalizations, key);
    return entityId;
}

function visit(obj, entities, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    if (isProtobuf(obj) && isEntity(obj, key)) {
        return visitEntity(obj, entities, normalizations, key);
    } else if (isProtobuf(obj)) {
        return visitProtobuf(obj, entities, normalizations);
    } else if (obj instanceof Array) {
        return visitArray(obj, entities, normalizations);
    }

    return obj;
}

function denormalizeEntity(entity, entityKey, key, state) {
    var parent = arguments.length <= 4 || arguments[4] === undefined ? null : arguments[4];
    var validator = arguments.length <= 5 || arguments[5] === undefined ? null : arguments[5];

    // Create a copy of the entity which we'll denormalize. This ensures we're not inflating entities when
    // denormalizing.
    var denormalizedEntity = entity.$type.clazz.decode(entity.encode());
    if (hasEntityTypeInNormalizations(entityKey, state)) {
        var fieldNames = denormalizedEntity.$type._fieldsByName;
        var normalizations = getNormalizationsFromState(entityKey, key, state);
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = iterKeys(normalizations)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var field = _step.value;

                var value = get(normalizations, field);
                if (!fieldNames[field].resolvedType) {
                    continue;
                }

                var type = fieldNames[field].resolvedType.fqn().toLowerCase();
                // Prevent circular relationships
                if (type === parent) {
                    continue;
                }

                if (value instanceof Array || _immutable2['default'].Iterable.isIterable(value)) {
                    denormalizedEntity.set(field, []);
                    var _iteratorNormalCompletion2 = true;
                    var _didIteratorError2 = false;
                    var _iteratorError2 = undefined;

                    try {
                        for (var _iterator2 = iterValues(value)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                            var id = _step2.value;

                            // handle normal JS objects converting keys to strings
                            id = String(id);
                            var normalizedValue = getEntityFromState(type, id, state);
                            denormalizedEntity[field].push(denormalizeEntity(normalizedValue, type, id, state, parent = entityKey));
                        }
                    } catch (err) {
                        _didIteratorError2 = true;
                        _iteratorError2 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion2 && _iterator2['return']) {
                                _iterator2['return']();
                            }
                        } finally {
                            if (_didIteratorError2) {
                                throw _iteratorError2;
                            }
                        }
                    }
                } else {
                    // handle normal JS objects converting keys to strings
                    value = String(value);
                    var normalizedValue = getEntityFromState(type, value, state);
                    denormalizedEntity.set(field, denormalizeEntity(normalizedValue, type, value, state, parent = entityKey));
                }
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion && _iterator['return']) {
                    _iterator['return']();
                }
            } finally {
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    }

    if (validator && !validator(denormalizedEntity, entityKey, key)) {
        return null;
    }

    return denormalizedEntity;
}

function normalize(obj) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    var entities = {};
    var normalizations = {};
    var result = visit(obj, entities, normalizations, key);
    return { entities: entities, normalizations: normalizations, result: result };
}

/**
* Denormalizes the entity that is associated with the key.
*
* @param {Object} key
* @param {Builder} builder
* @param {Map} state
* @param {Function} validator Accepts three parameters (denormalized entity, entity key, key) and returns false if entity is invalid
* @return {Array}|{Object}|{Void} denormalized entity or null if invalid or not found
*/

function denormalize(key, builder, state) {
    var validator = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    var entityKey = getEntityKey(builder);
    if (!hasEntityTypeInEntities(entityKey, state)) {
        return;
    }
    if (Array.isArray(key) || _immutable2['default'].Iterable.isIterable(key)) {
        var _ret = (function () {
            var entities = [];
            var entitiesValid = key.every(function (id) {
                // handle JS objects converting keys to strings
                id = String(id);
                var entity = getEntityFromState(entityKey, id, state);
                var denormalizedEntity = denormalizeEntity(entity, entityKey, id, state, undefined, validator);
                var entityValid = true;
                if (validator) {
                    entityValid = validator(denormalizedEntity, entityKey, id);
                }
                if (entityValid) {
                    entities.push(denormalizedEntity);
                }
                return entityValid;
            });
            if (entitiesValid) {
                return {
                    v: entities
                };
            } else {
                return {
                    v: null
                };
            }
        })();

        if (typeof _ret === 'object') return _ret.v;
    } else {
        var entity = getEntityFromState(entityKey, key, state);
        if (!entity) {
            return;
        }
        return denormalizeEntity(entity, entityKey, key, state, undefined, validator);
    }
}

function getNormalizations(normalizationsKey, key, builder, state) {
    var entityKey = getEntityKey(builder);
    if (!hasEntityTypeInNormalizations(entityKey, state)) {
        return;
    }
    var normalizations = getNormalizationsFromState(entityKey, key, state);
    if (!normalizations) {
        return;
    }
    return normalizations[normalizationsKey];
}