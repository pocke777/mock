'use strict';

// import
import gulp from 'gulp';
import source from 'vinyl-source-stream';
// import sass from 'gulp-sass';
// import sassGlob from 'gulp-sass-glob';
import stylus from 'gulp-stylus';
import pleeease from 'gulp-pleeease';
import browserify from 'browserify';
import babelify from 'babelify';
import pug from 'gulp-pug';
import browserSync from 'browser-sync';
import readConfig from 'read-config';
import watch from 'gulp-watch';
import RevLogger from 'rev-logger';
import through2 from 'through2';
import $ from 'jquery';

// const
const SRC = './src';
const CONFIG = './src/config';
// const HTDOCS = './public';
const HTDOCS = '../../../public/2018/01';
const PUBLIC = '../../../public';

const BASE_PATH = '';
const DEST = `${HTDOCS}${BASE_PATH}`;

const revLogger = new RevLogger({
    'style.css': `${DEST}/css/style.css`,
    'script.js': `${DEST}/js/script.js`
});


// css
gulp.task('stylus', () => {
    const config = readConfig(`${CONFIG}/pleeease.json`);
    return gulp.src(`${SRC}/styl/**/[!_]*.styl`)
        .pipe(stylus())
        .pipe(pleeease(config))
        .pipe(gulp.dest(`${DEST}/css`));
});

gulp.task('css', gulp.series('stylus'));

gulp.task('browserify', () => {
  return gulp.src([`${SRC}/js/**/[!_]*.js[x]`,`${SRC}/js/**/[!_]*.js`])
        .pipe(through2.obj(function(file, encode, callback) {
            browserify(file.path)
                .transform(babelify)
                .bundle((err, res)=> {
                  if (err) {
                    console.log(err.message);
                    console.log(err.stack);
                  }
                  file.contents = res;
                    callback(null, file);
                });
        }))
        .pipe(gulp.dest(`${DEST}/js`));
});

gulp.task('js', gulp.parallel('browserify'));

// html
gulp.task('pug', () => {
    const locals = readConfig(`${CONFIG}/meta.yml`);
    locals.versions = revLogger.versions();
    locals.basePath = BASE_PATH;
    
    return gulp.src(`${SRC}/pug/**/[!_]*.pug`)
        .pipe(pug({
            locals: locals,
            pretty: true,
            basedir: `${SRC}/pug`
        }))
        .pipe(gulp.dest(`${DEST}`));
});

gulp.task('html', gulp.series('pug'));


// serve
gulp.task('browser-sync', () => {
    browserSync({
        server: {
            baseDir: PUBLIC
        },
        startPath: `${BASE_PATH}/`,
        ghostMode: false
    });

    watch([`${SRC}/styl/**/*.styl`], gulp.series('stylus', browserSync.reload));
    watch([`${SRC}/js/**/*.js[x]`, `${SRC}/js/**/*.js`], gulp.series('browserify', browserSync.reload));
    watch([
        `${SRC}/pug/**/*.pug`,
        `${SRC}/config/meta.yml`
    ], gulp.series('pug', browserSync.reload));

    revLogger.watch((changed) => {
        gulp.series('pug', browserSync.reload)();
    });
});

gulp.task('serve', gulp.series('browser-sync'));


// default
gulp.task('build', gulp.parallel('css', 'js', 'html'));
gulp.task('default', gulp.series('build', 'serve'));
