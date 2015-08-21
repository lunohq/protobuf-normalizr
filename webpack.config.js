var webpack = require('webpack');

module.exports = {
    entry: './src/index',
    module: {
        loaders: [
            { test: /\.js$/, loader: 'babel?stage=0', exclude: /node_modules/ }
        ]
    },
    output: {
        filename: 'dist/protobuf-normalizr.min.js',
        libraryTarget: 'umd',
        library: 'protobuf-normalizr'
    },
    plugins: [
        new webpack.optimize.OccurenceOrderPlugin(),
        new webpack.DefinePlugin({
            'process.env': {
                'NODE_ENV': JSON.stringify('production')
            }
        }),
        new webpack.optimize.UglifyJsPlugin({
            compressor: {
                warnings: false
            }
        })
    ]
};

