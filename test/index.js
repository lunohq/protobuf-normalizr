import { should } from 'chai';
import Protobuf from 'protobufjs';

import normalize, { denormalize, getNormalizations } from '../lib';
import { createRequiredFieldsValidator } from '../lib/validators';
import combine from '../lib/combine';

should();

const builder = Protobuf.loadProtoFile('./test/sample.proto');

const mockProto = (builder, className, parameters) => {
    const ProtobufBuilder = builder.build(className);
    return new ProtobufBuilder(parameters);
}

const mockStatus = (builder, parameters={}) => {
    const defaults = {
        id: 1,
        value: 'status value',
    }
    return mockProto(builder, 'test.messages.Status', Object.assign({}, defaults, parameters));
}

const mockProfile = (builder, parameters={}, statusParameters={}) => {
    const defaults = {
        id: 1,
        name: 'Name',
        title: 'Title',
        status: mockStatus(builder, statusParameters),
    }
    return mockProto(
        builder,
        'test.messages.Profile',
        Object.assign({}, defaults, parameters)
    );
}

const mockAddress = (builder, parameters={}) => {
    const defaults = {
        id: 1,
        street: 'Market',
        city: 'SF',
        state: 'CA',
        member_ids: ['1', '2', '3'],
    };

    return mockProto(
        builder,
        'test.messages.Address',
        Object.assign({}, defaults, parameters)
    );
}

const mockMultipleProfileResponse = (builder, parameters={}) => {
    const defaults = {
        profiles: [mockProfile(builder, {id: 1}, {id: 1}), mockProfile(builder, {id: 2}, {id: 2})],
    }
    return mockProto(
        builder,
        'test.messages.MultipleProfileResponse',
        Object.assign({}, defaults, parameters)
    );
}

const mockNestedProfileResponse = (builder) => {
    const defaults = {
        profile: mockProfile(builder),
        status: mockStatus(builder, {profile: mockProfile(builder, {status: null})}),
    }
    return mockProto(
        builder,
        'test.messages.NestedProfileResponse',
        defaults
    );
}

const mockLocation = (
    builder,
    parameters={},
    addressParameters={},
    adminParameters={id: 1},
    profileParameters={id: 2}
) => {
    const defaults = {
        id: 1,
        name: 'HQ',
        address: mockAddress(builder, addressParameters),
        admin: mockProfile(builder, adminParameters, {id: 1}),
        profiles: [mockProfile(builder, profileParameters, {id: 2})],
    }

    return mockProto(
        builder,
        'test.messages.Location',
        Object.assign({}, defaults, parameters)
    );
}

describe('pbnormalizr', () => {

    describe('normalize', () => {

        it('can normalize a single entity', () => {
            const address = mockAddress(builder);
            normalize(address).should.eql({
                result: 1,
                entities: {
                    '.test.messages.address': {
                        1: address,
                    },
                },
                normalizations: {},
            });
        });

        it('can normalize a partial entity', () => {
            const address = mockAddress(builder, {street: null});
            normalize(address).should.eql({
                result: 1,
                entities: {
                    '.test.messages.address': {
                        1: address,
                    },
                },
                normalizations: {},
            });
        });

        it('can normalize an array of single entities', () => {
            const [address1, address2] = [
                mockAddress(builder),
                mockAddress(builder, {id: 2}),
            ];
            normalize([address1, address2]).should.eql({
                result: [1, 2],
                entities: {
                    '.test.messages.address': {
                        1: address1,
                        2: address2,
                    },
                },
                normalizations: {},
            });
        });

        it('can normalize an entity with a nested non-entity protobuf', () => {
            const profile = mockProfile(builder);
            const status = profile.status;
            normalize(profile).should.eql({
                result: 1,
                entities: {
                    '.test.messages.profile': {
                        1: profile,
                    },
                    '.test.messages.status': {
                        1: status,
                    },
                },
                normalizations: {
                    '.test.messages.profile': {
                        1: {
                            'status': 1,
                        },
                    },
                },
            });
        });

        it('can normalize an entity with nested entities', () => {
            const location = mockLocation(builder);
            const expected = location.$type.clazz.decode(location.encode());
            const expectedAdmin = expected.admin;
            const expectedStatus1 = expectedAdmin.get('status');
            expectedAdmin.set('status', null);
            const expectedProfile = expected.profiles[0];
            const expectedStatus2 = expectedProfile.get('status');
            expectedProfile.set('status', null);
            normalize(location).should.eql({
                result: 1,
                entities: {
                    '.test.messages.profile': {
                        1: expectedAdmin,
                        2: expectedProfile,
                    },
                    '.test.messages.location': {
                        1: location,
                    },
                    '.test.messages.address': {
                        1: expected.address,
                    },
                    '.test.messages.status': {
                        1: expectedStatus1,
                        2: expectedStatus2,
                    },
                },
                normalizations: {
                    '.test.messages.location': {
                        1: {
                            profiles: [2],
                            admin: 1,
                            address: 1,
                        },
                    },
                    '.test.messages.profile': {
                        1: {
                            status: 1,
                        },
                        2: {
                            status: 2,
                        },
                    },
                },
            });
        });

        it('can normalize a message with nested entities', () => {
            const response = mockMultipleProfileResponse(builder);
            const expected = response.$type.clazz.decode(response.encode());
            const status1 = expected.profiles[0].status;
            const status2 = expected.profiles[1].status;
            // simulate normalization unsetting these
            expected.profiles[0].set('status', null);
            expected.profiles[1].set('status', null);
            const key = 'some_parameter_id';
            normalize(response, key)
                .should.eql({
                    result: key,
                    entities: {
                        '.test.messages.profile': {
                            1: expected.profiles[0],
                            2: expected.profiles[1],
                        },
                        '.test.messages.multipleprofileresponse': {
                            some_parameter_id: response,
                        },
                        '.test.messages.status': {
                            1: status1,
                            2: status2,
                        },
                    },
                    normalizations: {
                        '.test.messages.multipleprofileresponse': {
                            some_parameter_id: {
                                profiles: [1, 2],
                            },
                        },
                        '.test.messages.profile': {
                            1: {
                                status: 1
                            },
                            2: {
                                status: 2
                            },
                        },
                    },
                });
        });

    });

    describe('denormalize', () => {

        it('can denormalize a normalized response', () => {
            const response = mockMultipleProfileResponse(builder);
            const expected = response.$type.clazz.decode(response.encode());
            const key = 'key';
            const state = normalize(response, key);
            denormalize(key, builder.build('test.messages.MultipleProfileResponse'), state)
                .should.eql(expected);
            should().not.exist(response.profiles);
        })

        it('can denormalize a single entity', () => {
            const address = mockAddress(builder);
            const state = normalize(address);
            denormalize(state.result, builder.build('test.messages.Address'), state)
                .should.eql(address);
        });

        it('will return undefined if entity isn\'t found', () => {
            const address = mockAddress(builder);
            const state = normalize(address);
            const entity = denormalize('random', builder.build('test.messages.Address'), state);
            should().not.exist(entity);
        });

        it('will return null if the protobuf doesn\'t pass validation', () => {
            // Test with validator that checks for required fields
            const requiredFields = ['admin.status.value'];
            const validator = createRequiredFieldsValidator(requiredFields);
            let location = mockLocation(
                builder,
                undefined,
                undefined,
                {id: 1, status: {value: null}}
            );
            let state = normalize(location);
            let denormalized = denormalize(
                state.result,
                builder.build('test.messages.Location'),
                state,
                validator
            );
            should().not.exist(denormalized, 'location should not have been denormalized');

            location = mockLocation(builder);
            state = normalize(location);
            denormalized = denormalize(
                state.result,
                builder.build('test.messages.Location'),
                state,
                validator
            );
            should().exist(denormalized, 'should have denormalized the location');
            should().exist(denormalized.admin.status.value, 'admin.status.value should be populated');
        });

        it('will run validation on protobufs that don\'t have normalizations', () => {
            const requiredFields = ['value'];
            const validator = createRequiredFieldsValidator(requiredFields);
            let status = mockStatus(builder, {value: null});
            let state = normalize(status);
            let denormalized = denormalize(state.result, builder.build('test.messages.Status'), state, validator);
            should().not.exist(denormalized, 'status should not have been denormalized');

            status = mockStatus(builder);
            state = normalize(status);
            denormalized = denormalize(state.result, builder.build('test.messages.Status'), state, validator);
            should().exist(denormalized, 'status should have been denormalized');
        });

        it('supports composing validators', () => {
            const validator1 = createRequiredFieldsValidator(['name']);
            const validator2 = createRequiredFieldsValidator(['admin.status.value']);
            const combinedValidator = combine(validator1, validator2);
            let location = mockLocation(
                builder,
                undefined,
                undefined,
                {id: 1, status: {value: null}}
            );
            let state = normalize(location);
            let denormalized = denormalize(
                state.result,
                builder.build('test.messages.Location'),
                state,
                combinedValidator
            );
            should().not.exist(denormalized, 'combinedValidator should not have denormalized the entity');

            denormalized = denormalize(
                state.result,
                builder.build('test.messages.Location'),
                state,
                validator1
            )
            should().exist(denormalized, 'validator1 should have denormalized the entity');

            denormalized = denormalize(
                state.result,
                builder.build('test.messages.Location'),
                state,
                validator2
            )
            should().not.exist(denormalized, 'validator2 should not have denormalized the entity');

            location = mockLocation(builder);
            state = normalize(location);
            debugger;
            denormalized = denormalize(
                state.result,
                builder.build('test.messages.Location'),
                state,
                combinedValidator
            );
            should().exist(denormalized, 'combinedValidator should have denormalized the entity');
        });

        it('can denormalize an array of normalized entities', () => {
            const [address1, address2] = [
                mockAddress(builder),
                mockAddress(builder, {id: 2}),
            ];
            const state = normalize([address1, address2]);
            denormalize(state.result, builder.build('test.messages.Address'), state)
                .should.eql([address1, address2]);
        });

        it('can denormalize nested entities', () => {
            const response = mockNestedProfileResponse(builder);
            const expected = response.$type.clazz.decode(response.encode());
            const key = 'key';
            const state = normalize(response, key);
            denormalize(key, builder.build('test.messages.NestedProfileResponse'), state)
                .should.eql(expected);
        });

    });

    describe('getNormalizations', () => {

        it('can get the normalizations for an object', () => {
            const location = mockLocation(builder);
            const expected = location.$type.clazz.decode(location.encode());
            const normalized = normalize(location);
            (getNormalizations('profiles', normalized.result, location.$type.clazz, normalized)).should.eql([2]);
        });

        it('handles not having any normalizations', () => {
            const location = mockLocation(builder);
            const state = {};
            should().not.exist(getNormalizations('profiles', '123', location.$type.clazz, state));
        });

    });

})
