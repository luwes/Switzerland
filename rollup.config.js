// rollup.config.js
import babel from 'rollup-plugin-babel';
import bundleSize from 'rollup-plugin-bundle-size';
import commonjs from 'rollup-plugin-commonjs';
import inject from 'rollup-plugin-inject';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';

const env = process.env.NODE_ENV || 'production';

const bundles = [{
    input: 'src/switzerland.js',
    output: {
        file: 'core.js',
        format: 'es'
    }
}, {
    input: 'example/js/todo-app/index.js',
    output: {
        file: 'example/js/todo-app/build.js',
        format: 'iife',
        name: 'SwissTodo'
    }
}, {
    input: 'example/js/todo-app/worker.js',
    output: {
        file: 'example/js/todo-app/build-worker.js',
        format: 'iife',
        name: 'SwissWorker'
    }
}];

export default bundles.map(bundle => ({
    ...bundle,
    plugins: [
        resolve({
            browser: true // make nanoid use browser `crypto`
        }),
        commonjs({
            exclude: ['src/**', 'example/js/**']
        }),
        replace({
            'process.env.NODE_ENV': JSON.stringify(env)
        }),
        babel({
            exclude: 'node_modules/**' // only transpile our source code
        }),
        inject({
            exclude: [
                'node_modules/**/native-promise-only/**',
                'node_modules/**/es6-symbol/**',
                'node_modules/**/poorlyfills/**'
            ],
            modules: {
                regeneratorRuntime: 'regenerator-runtime',
                Promise: 'native-promise-only',
                Symbol: 'es6-symbol',
                WeakMap: ['poorlyfills', 'WeakMap'],
                WeakSet: ['poorlyfills', 'WeakSet'],
                Map: ['poorlyfills', 'Map'],
                Set: ['poorlyfills', 'Set']
            }
        }),
        bundleSize()
    ]
}));
