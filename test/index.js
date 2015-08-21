import { should } from 'chai';
import Protobuf from 'protobufjs';

import normalize, { denormalize } from '../lib/index';

should();

const builder = Protobuf.loadProtoFile('./test/sample.proto');

const mockProto = (builder, className, parameters) => {
    const ProtobufBuilder = builder.build(className);
    return new ProtobufBuilder(parameters);
}

const mockStatus = (builder, parameters={}) => {
    const defaults = {
        value: 'status value',
    }
    return mockProto(builder, 'Status', Object.assign({}, defaults, parameters));
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
        'Profile',
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
        'Address',
        Object.assign({}, defaults, parameters)
    );
}

const mockMultipleProfileResponse = (builder, parameters={}) => {
    const defaults = {
        profiles: [mockProfile(builder, {id: 1}), mockProfile(builder, {id: 2})],
    }
    return mockProto(
        builder,
        'MultipleProfileResponse',
        Object.assign({}, defaults, parameters)
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
        admins: [mockProfile(builder, adminParameters)], 
        profiles: [mockProfile(builder, profileParameters)],
    }

    return mockProto(
        builder,
        'Location',
        Object.assign({}, defaults, parameters)
    );
}

describe('protobuf-normalizr', () => {

    describe('normalize', () => {

        it('can normalize a single entity', () => {
            const address = mockAddress(builder);
            normalize(address).should.eql({
                result: 1,
                protobufs: {
                    address: {
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
                protobufs: {
                    address: {
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
                protobufs: {
                    address: {
                        1: address1,
                        2: address2,
                    },
                },
                normalizations: {},
            });
        });

        it('can normalize an entity with a nested non-entity protobuf', () => {
            const profile = mockProfile(builder);
            normalize(profile).should.eql({
                result: 1,
                protobufs: {
                    profile: {
                        1: profile,
                    },
                },
                normalizations: {},
            });
        });

        it('can normalize an entity with nested entities', () => {
            const location = mockLocation(builder);
            const expected = location.$type.clazz.decode(location.encode());
            normalize(location).should.eql({
                result: 1,
                protobufs: {
                    profile: {
                        1: expected.admins[0],
                        2: expected.profiles[0],
                    },
                    location: {
                        1: location,
                    },
                    address: {
                        1: expected.address,
                    },
                },
                normalizations: {
                    location: {
                        1: {
                            profiles: [2],
                            admins: [1],
                            address: 1,
                        },
                    }
                },
            });
        });

        it('can normalize a message with nested entities', () => {
            const response = mockMultipleProfileResponse(builder);
            const expected = response.$type.clazz.decode(response.encode());
            const key = 'key';
            normalize(response, key)
                .should.eql({
                    result: key,
                    protobufs: {
                        profile: {
                            1: expected.profiles[0],
                            2: expected.profiles[1],
                        },
                        multipleprofileresponse: {
                            key: response,
                        },
                    },
                    normalizations: {
                        multipleprofileresponse: {
                            key: {
                                profiles: [1, 2],
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
            denormalize(key, builder.build('MultipleProfileResponse'), state)
                .should.eql(expected);
        })

        it('can denormalize a single entity', () => {
            const address = mockAddress(builder);
            const state = normalize(address);
            denormalize(state.result, builder.build('Address'), state)
                .should.eql(address);

        });
    });

})
