function entityHasValueForField(entity, field) {
    const parts = field.split('.');
    const part = parts[0];
    const remainder = parts.slice(1).join('.');
    const value = entity[part];
    if (value !== undefined && value !== null) {
        if (remainder) {
            return entityHasValueForField(value, remainder);
        }
        return true;
    }
    return false;
}

export function createRequiredFieldsValidator(fields) {
    return (denormalizedEntity, entityKey, key) => {
        for (let field of fields) {
            if (!entityHasValueForField(denormalizedEntity, field)) {
                return false;
            }
        }
        return true;
    }
}
