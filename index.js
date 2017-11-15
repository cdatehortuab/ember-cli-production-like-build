/* global require, module, escape */
'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const p = require('ember-cli-preprocess-registry/preprocessors');
const defaultsDeep  = require('ember-cli-lodash-subset').defaultsDeep;
const SilentError  = require('silent-error');
const fs = require('fs');
const path = require('path');
const Bundler = require('ember-cli/lib/broccoli/bundler');

const ProdLikeEmberApp = function(defaults, options) {
	let env = EmberApp.env();
	let productionLikeEnv = options.productionLikeEnv ? options.productionLikeEnv : [];

	let isProductionLikeBuild = env === 'production' || productionLikeEnv.indexOf(env) > -1;

	if (!defaults) {
		defaults = {};
	}

	if (!defaults.fingerprint) {
		defaults.fingerprint = {};
	}
	defaults.fingerprint.enabled = !!isProductionLikeBuild;

	if (!defaults.minifyCSS) {
		defaults.minifyCSS = {};
	}
	defaults.minifyCSS.enabled = !!isProductionLikeBuild;

	if (!defaults.minifyJS) {
		defaults.minifyJS = {};
	}
	defaults.minifyJS.enabled = !!isProductionLikeBuild;

	if (arguments.length === 0) {
		options = {};
	} else if (arguments.length === 1) {
		options = defaults;
	} else {
		defaultsDeep(options, defaults);
	}

	this._initProject(options);
	this.name = options.name || this.project.name();

	this.env = EmberApp.env();
	this.isProduction = (isProductionLikeBuild || this.env === 'production');
	if (this.isProduction) {
		process.env.EMBER_ENV = "production";
	}

	this.registry = options.registry || p.defaultRegistry(this);

	this.bowerDirectory = this.project.bowerDirectory;

	this._initTestsAndHinting(options);
	this._initOptions(options);
	this._initVendorFiles();

	this._styleOutputFiles = {};

	// ensure addon.css always gets concated
	this._styleOutputFiles[this.options.outputPaths.vendor.css] = [];

	this._scriptOutputFiles = {};
	this._customTransformsMap = new Map();

	this.legacyFilesToAppend = [];
	this.vendorStaticStyles = [];
	this.otherAssetPaths = [];
	this.legacyTestFilesToAppend = [];
	this.vendorTestStaticStyles = [];
	this._nodeModules = new Map();

	this.trees = this.options.trees;

	this.populateLegacyFiles();
	this.initializeAddons();
	this.project.addons.forEach(addon => addon.app = this);
	p.setupRegistry(this);
	this._importAddonTransforms();
	this._notifyAddonIncluded();

	if (!this._addonInstalled('loader.js') && !this.options._ignoreMissingLoader) {
		throw new SilentError('The loader.js addon is missing from your project, please add it to `package.json`.');
	}

	this.bundler = new Bundler({
		name: this.name,
		sourcemaps: this.options.sourcemaps,
		appOutputPath: this.options.outputPaths.app.js,
		vendorFilePath: this.options.outputPaths.vendor.js,
		isBabelAvailable: this._addonInstalled('ember-cli-babel'),
	});
};

ProdLikeEmberApp.prototype = Object.create(EmberApp.prototype);
ProdLikeEmberApp.prototype.constructor = ProdLikeEmberApp;

ProdLikeEmberApp.prototype.toPublicDir = function(asset, destination) {
	destination = 'public' + destination;
	ensureDirectoryExistence(destination);
	fs.createReadStream(asset).pipe(fs.createWriteStream(destination));
};

module.exports = ProdLikeEmberApp;

function ensureDirectoryExistence(filePath) {
	let dir = path.dirname(filePath);
	if (fs.existsSync(dir)) {
		return true;
	}
	ensureDirectoryExistence(dir);
	fs.mkdirSync(dir);
}
