import { should } from 'chai';
import Protobuf from 'protobufjs';

import normalize, { denormalize, getNormalizations } from '../lib/index';

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
        state: 'CA'
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
        admins: [mockProfile(builder, adminParameters, {id: 1})],
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
            const expectedAdmin = expected.admins[0];
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
                            admins: [1],
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

    });

})
