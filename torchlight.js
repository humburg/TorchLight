/*
 * ----------------------------------------------------------------------------
 * "THE BEER-WARE LICENSE" (Revision 42):
 * <shurd@FreeBSD.ORG> wrote this file.  As long as you retain this notice you
 * can do whatever you want with this stuff. If we meet some day, and you think
 * this stuff is worth it, you can buy me a beer in return.        Stephen Hurd
 * ----------------------------------------------------------------------------
 * <philippe@krait.net> updated this file.  As long as you retain this notice
 * you can do whatever you want with this stuff. If we meet some day, and you
 * think this stuff is worth it, you can buy me a beer in return, but only if
 * you promise to buy one for Stephen as well.                   Philippe Krait
 * ----------------------------------------------------------------------------
 * <alan.n.davies@gmail.com> updated this file.  As long as you retain this
 * notice you can do whatever you want with this stuff.  If we meet some day,
 * and you think this stuff is worth it, you can buy me a beer in return, but
 * only if you promise to buy one for Stephen and Philippe as well.
 * Alan Davies
 * ----------------------------------------------------------------------------
 * <peter.humburg@gmail.com> updated this file.  As long as you retain this
 * notice you can do whatever you want with this stuff.  If we meet some day,
 * and you think this stuff is worth it, you can buy me a beer in return, but
 * only if you promise to buy one for Stephen, Philippe, and Alan as well.
 * Peter Humburg
 * ----------------------------------------------------------------------------
 */

class TorchLight {
	static buttons = {
		light: $(`<div class="control-icon torchlight" title="Toggle Light Spell"><i class="fas fa-sun"></i></div>`),
		lantern: $(`<div class="control-icon torchlight" title="Toggle Lantern"><i class="fas fa-lightbulb"></i></div>`),
		torch: $(`<div class="control-icon torchlight" title="Toggle Torch"><i class="fas fa-fire"></i></div>`)
	}

	// disable light spell
	static async extinguishLight(sceneId, tokenId, light) {
		console.log("Deactivating " + light + ".");
		const token = game.scenes.get(sceneId).tokens.get(tokenId);
		await token.setFlag("torchlight", light + "Status", false);
		TorchLight.buttons[light].removeClass("active");
		// Light is inactive, enable the relevant light sources according to parameters
		TorchLight.enableRelevantButtons(token);
		// Restore the initial light source
		await token.data.update(await TorchLight.getStoredLighting(token));
		if(game.settings.get("torchlight", light + "Duration") > 0){
			game.Gametime.clearTimeout(token.getFlag("torchlight", light + "Timer"));
			await token.unsetFlag("torchlight", light + "Timer");
		}
	}

	// Visually and functionally enable a torchlight button
	static enableTorchlightButton(tbutton, token) {
		// Remove the disabled status, if any
		tbutton.find('i').removeClass('fa-disabled');
		tbutton.click(async (ev) => TorchLight.onButtonClick(ev, tbutton, token));
	}

	// Visually and functionally disable a torchlight button
	static disableTorchlightButton(tbutton) {
		tbutton.find('i').addClass('fa-disabled');
		tbutton.off('click');
		tbutton.removeClass('active');
	}

	// Enable or disable buttons according to parameters
	static enableRelevantButtons(token) {
		const data = token.data;
		// Stores if checks need to be made to enable buttons
		let noCheck = game.system.id !== 'dnd5e';
		if (!noCheck)
			noCheck = (game.user.isGM && !game.settings.get("torchlight", "dmAsPlayer")) || !game.settings.get("torchlight", "checkAvailability");

		if (noCheck || TorchLight.canCastLight(data))
			TorchLight.enableTorchlightButton(TorchLight.buttons.light, token);
		else
			TorchLight.disableTorchlightButton(TorchLight.buttons.light);

		if (noCheck || (TorchLight.hasItemInInventory(game.settings.get("torchlight", "nameConsumableLantern"), data) && (TorchLight.hasItemInInventory("Lantern, Hooded", data) || TorchLight.hasItemInInventory("Lantern, Bullseye"), data)))
			TorchLight.enableTorchlightButton(TorchLight.buttons.lantern, token);
		else
			TorchLight.disableTorchlightButton(TorchLight.buttons.lantern);

		if (noCheck || TorchLight.hasItemInInventory(game.settings.get("torchlight", "nameConsumableTorch"), data))
			TorchLight.enableTorchlightButton(TorchLight.buttons.torch, token);
		else
			TorchLight.disableTorchlightButton(TorchLight.buttons.torch);
	}

	// Returns true if the character can use the Light spell
	// This also returns true if the game system is not D&D 5e...
	static canCastLight(data) {
		let actor = game.actors.get(data.actorId);
		if (actor === undefined)
			return false;
		let hasLight = false;
		actor.data.items.forEach(item => {
			if (item.type === 'spell') {
				if (item.name === 'Light')
					hasLight = true;
			}
		});
		return hasLight;
	}

	// Returns true if the character has a specific item in his inventory
	// This also returns true if the game system is not D&D 5e...
	static hasItemInInventory(itemToCheck, data) {
		let actor = game.actors.get(data.actorId);
		if (actor === undefined)
			return false;
		let hasItem = false;
		actor.data.items.forEach(item => {
			if (item.name.toLowerCase() === itemToCheck.toLowerCase()) {
				if (item.data.data.quantity > 0)
					hasItem = true;
			}
		});
		return hasItem;
	
	}

	static async startTimer(scene, token, source){
		if(game.settings.get("torchlight", source + "Duration") > 0){
			let lightTimer = game.Gametime.doIn({minutes: game.settings.get("torchlight", source + "Duration")}, (s, t, y) => TorchLight.extinguishLight(s, t, y), scene.id, token.id, source);
			await token.setFlag("torchlight", source + "Timer", lightTimer);
		}
	}
	static async onButtonClick(ev, tbutton, token) {
		//console.log("Clicked on a Button.");
		ev.preventDefault();
		ev.stopPropagation();

		// Are we dealing with the Light Button
		if (tbutton === TorchLight.buttons.light) {
			// Check if the token has the light spell on
			if (token.getFlag("torchlight", "lightStatus")) {
				// The token has the light spell on
				TorchLight.extinguishLight(game.scenes.current.id, token.id, "light");
			} else {
				// The token does not have the light spell on
				console.log("Clicked on the light button when the light is off.");
				await token.setFlag("torchlight", "lightStatus", true);
				TorchLight.buttons.light.addClass("active");
				// Light is active, disable the other light sources
				TorchLight.disableTorchlightButton(TorchLight.buttons.lantern);
				TorchLight.disableTorchlightButton(TorchLight.buttons.torch);
				// Store the lighting for later restoration
				await TorchLight.saveTokenLighting(token);
				// Enable the Light Source according to the type
				// "torch" / "pulse" / "chroma" / "wave" / "fog" / "sunburst" / "dome"
				// "emanation" / "hexa" / "ghost" / "energy" / "roiling" / "hole"
				let nBright = game.settings.get("torchlight", "lightBrightRadius");
				let nDim    = game.settings.get("torchlight", "lightDimRadius");
				let nType   = game.settings.get("torchlight", "lightType");
				switch (nType){
					case "Type0":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ffffff", 0.5, 360, "none", 5, 5);
						break;
					case "Type1":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ffffff", 0.5, 360, "torch", 5, 5);
						break;
					case "Type2":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ffffff", 0.5, 360, "chroma", 5, 5);
						break;
					case "Type3":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ffffff", 0.5, 360, "pulse", 5, 5);
						break;
					case "Type4":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ffffff", 0.5, 360, "ghost", 5, 5);
						break;
					case "Type5":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ffffff", 0.5, 360, "emanation", 5, 5);
						break;
					case "Type6":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ff0000", 0.5, 360, "torch", 5, 5);
						break;
					case "Type7":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ff0000", 0.5, 360, "chroma", 5, 5);
						break;
					case "Type8":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ff0000", 0.5, 360, "pulse", 5, 5);
						break;
					case "Type9":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ff0000", 0.5, 360, "ghost", 5, 5);
						break;
					case "Type10":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#ff0000", 0.5, 360, "emanation", 5, 5);
						break;
					case "Type11":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#00ff00", 0.5, 360, "torch", 5, 5);
						break;
					case "Type12":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#00ff00", 0.5, 360, "chroma", 5, 5);
						break;
					case "Type13":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#00ff00", 0.5, 360, "pulse", 5, 5);
						break;
					case "Type14":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#00ff00", 0.5, 360, "ghost", 5, 5);
						break;
					case "Type15":
						TorchLight.updateTokenLighting(token, nBright,nDim, "#00ff00", 0.5, 360, "emanation", 5, 5);
						break;
					case "TypeC":
						TorchLight.updateTokenLighting(token, nBright,nDim,
							game.settings.get("torchlight", "customLightColor"),
							game.settings.get("torchlight", "customLightColorIntensity"),
							360,
							game.settings.get("torchlight", "customLightAnimationType"),
							game.settings.get("torchlight", "customLightAnimationSpeed"),
							game.settings.get("torchlight", "customLightAnimationIntensity"));
						break;
				}
				// queue spell expiery
				TorchLight.startTimer(game.scenes.current, token, "light")
			}
		// Or are we dealing with the Lantern Button
		} else if (tbutton === TorchLight.buttons.lantern) {
			// Check if the token has the lantern on
			if (token.getFlag("torchlight", "lanternStatus")) {
				// The token has a lantern on
				TorchLight.extinguishLight(game.scenes.current.id, token.id, "lantern")
			} else {
				// The token does not have the lantern on
				console.log("Clicked on the lantern when the lantern is off.");
				// Checks whether the character can consume an oil flask
				if (TorchLight.consumeItem(game.settings.get("torchlight", "nameConsumableLantern"), token.data)) {
					await token.setFlag("torchlight", "lanternStatus", true);
					TorchLight.buttons.lantern.addClass("active");
					// Lantern is active, disable the other light sources
					TorchLight.disableTorchlightButton(TorchLight.buttons.light);
					TorchLight.disableTorchlightButton(TorchLight.buttons.torch);
					// Store the lighting for later restoration
					await TorchLight.saveTokenLighting(token);
					// Enable the Lantern Source according to the type
					let nBright = game.settings.get("torchlight", "lanternBrightRadius");
					let nDim    = game.settings.get("torchlight", "lanternDimRadius");
					let nType   = game.settings.get("torchlight", "lanternType");
					switch (nType){
						case "Type0":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a2642a", 0.7, 360, "none", 10, 7);
							break;
						case "Type1":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a2642a", 0.7, 360, "torch", 10, 7);
							break;
						case "Type2":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a2642a", 0.5, 360, "torch", 10, 5);
							break;
						case "Type3":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a2642a", 0.3, 360, "torch", 10, 3);
							break;
						case "Type4":
							TorchLight.updateTokenLighting(token, 5,5, "#a2642a", 0.7, 360, "torch", 10, 7);
							break;
						case "Type5":
							TorchLight.updateTokenLighting(token, 5,5, "#a2642a", 0.5, 360, "torch", 10, 5);
							break;
						case "Type6":
							TorchLight.updateTokenLighting(token, 5,5, "#a2642a", 0.3, 360, "torch", 10, 3);
							break;
						case "Type7":
							TorchLight.updateTokenLighting(token, nBright*2,nDim*2, "#a2642a", 0.7, 60, "torch", 10, 7);
							break;
						case "Type8":
							TorchLight.updateTokenLighting(token, nBright*2,nDim*2, "#a2642a", 0.5, 60, "torch", 10, 5);
							break;
						case "Type9":
							TorchLight.updateTokenLighting(token, nBright*2,nDim*2, "#a2642a", 0.3, 60, "torch", 10, 3);
							break;
						case "TypeC":
							TorchLight.updateTokenLighting(token, nBright,nDim,
								game.settings.get("torchlight", "customLanternColor"),
								game.settings.get("torchlight", "customLanternColorIntensity"),
								360,
								game.settings.get("torchlight", "customLanternAnimationType"),
								game.settings.get("torchlight", "customLanternAnimationSpeed"),
								game.settings.get("torchlight", "customLanternAnimationIntensity"));
							break;
					}

					// queue lantern expiery if we are managing light source duration
					TorchLight.startTimer(game.scenes.current, token, "lantern");
				} else {
					// There is no oil to consume, signal and disable the button
					ChatMessage.create({
						user: game.user._id,
						speaker: game.actors.get(data.actorId),
						content: "No " + game.settings.get("torchlight", "nameConsumableLantern") + " in Inventory !"
					});
					TorchLight.disableTorchlightButton(TorchLight.buttons.lantern);
				}
			}
		// Or are we dealing with the Torch Button
		} else if (tbutton === TorchLight.buttons.torch) {
			// Check if the token has the torch on
			if (token.getFlag("torchlight", "torchStatus")) {
				// The token has the torch on
				TorchLight.extinguishLight(game.scenes.current.id, token.id, "torch");
			} else {
				// The token does not have the torch on
				console.log("Clicked on the torch when the torch is off.");
				// Checks whether the character can consume a torch
				if (TorchLight.consumeItem(game.settings.get("torchlight", "nameConsumableTorch"), token.data)) {
					await token.setFlag("torchlight", "torchStatus", true);
					TorchLight.buttons.torch.addClass("active");
					// Torch is active, disable the other light sources
					TorchLight.disableTorchlightButton(TorchLight.buttons.light);
					TorchLight.disableTorchlightButton(TorchLight.buttons.lantern);
					// Store the lighting for later restoration
					await TorchLight.saveTokenLighting(token);
					// Enable the Torch Source according to the type
					let nBright = game.settings.get("torchlight", "torchBrightRadius");
					let nDim    = game.settings.get("torchlight", "torchDimRadius");
					let nType   = game.settings.get("torchlight", "torchType");
					switch (nType){
						case "Type0":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a2642a", 0.7, 360, "none", 5, 7);
							break;
						case "Type1":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a2642a", 0.7, 360, "torch", 5, 7);
							break;
						case "Type2":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a2642a", 0.5, 360, "torch", 5, 5);
							break;
						case "Type3":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a2642a", 0.3, 360, "torch", 5, 3);
							break;
						case "Type4":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a22a2a", 0.7, 360, "torch", 5, 7);
							break;
						case "Type5":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a22a2a", 0.5, 360, "torch", 5, 5);
							break;
						case "Type6":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#a22a2a", 0.3, 360, "torch", 5, 3);
							break;
						case "Type7":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#822aa2", 0.7, 360, "torch", 5, 7);
							break;
						case "Type8":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#822aa2", 0.5, 360, "torch", 5, 5);
							break;
						case "Type9":
							TorchLight.updateTokenLighting(token, nBright,nDim, "#822aa2", 0.3, 360, "torch", 5, 3);
							break;
						case "TypeC":
							TorchLight.updateTokenLighting(token, nBright,nDim,
								game.settings.get("torchlight", "customTorchColor"),
								game.settings.get("torchlight", "customTorchColorIntensity"),
								360,
								game.settings.get("torchlight", "customTorchAnimationType"),
								game.settings.get("torchlight", "customTorchAnimationSpeed"),
								game.settings.get("torchlight", "customTorchAnimationIntensity"));
							break;
					}
					// queue torch expiery
					TorchLight.startTimer(game.scenes.current, token, "torch")
				} else {
					// There is no torch to consume, signal and disable the button
					ChatMessage.create({
						user: game.user._id,
						speaker: game.actors.get(token.data.actorId),
						content: "No " + game.settings.get("torchlight", "nameConsumableTorch") + " in Inventory !"
					});
					TorchLight.disableTorchlightButton(TorchLight.buttons.torch);
				}
			}
		}
	}

	// Update the relevant light parameters of a token
	static updateTokenLighting(token, brightLight, dimLight, lightColor, colorIntensity, lightAngle, animationType, animationSpeed, animationIntensity) {
		token.data.update({
			brightLight: brightLight,
			dimLight: dimLight,
			lightColor: lightColor,
			lightAlpha: colorIntensity ** 2,
			lightAngle: lightAngle,
			lightAnimation: {
				type: animationType,
				speed: animationSpeed,
				intensity: animationIntensity
			}
		});
	}

	// store initial lighting setup
	static async saveTokenLighting(token) {
		return token.setFlag("torchlight", "InitialLight", TorchLight.getTokenLighting(token.data));
	}

	static getStoredLighting(token) {
		return token.getFlag("torchlight", "InitialLight");
	}

	// format current token lighting to restore later
	static getTokenLighting(data) {
		return {
			brightLight: data.brightLight,
			dimLight: data.dimLight,
			lightColor: data.lightColor ? data.lightColor.toString(16).padStart(6, 0) : null,
			lightAlpha: data.lightAlpha,
			lightAngle: data.lightAngle,
			lightAnimation: {
				type: data.lightAnimation.type,
				speed: data.lightAnimation.speed,
				intensity: data.lightAnimation.intensity
			}
		};
	}

	// Returns true if either the character does not need to consume an item
	// or if he can indeed consume it (and it is actually consumed)
	static consumeItem(itemToCheck, data) {
		let consume = game.system.id !== 'dnd5e';
		if (!consume)
			consume = (game.user.isGM && !game.settings.get("torchlight", "dmAsPlayer")) ||
							!game.settings.get("torchlight", "checkAvailability") ||
							!game.settings.get("torchlight", "consumeItem");
		if (!consume) {
			let actor = game.actors.get(data.actorId);
			if (actor === undefined)
				return false;
			let hasItem = false;
			actor.data.items.forEach(item => {
				if (item.name.toLowerCase() === itemToCheck.toLowerCase()) {
					if (item.data.data.quantity > 0) {
						hasItem = true;
						item.update({"data.quantity": item.data.data.quantity - 1});
					}
				}
			});
			consume = hasItem;
		}
		return consume;
	}

	/*
		 * Returns the first GM id.
		 */
	static firstGM() {
		let i;

		for (i=0; i<game.users.entities.length; i++) {
			if (game.users.entities[i].data.role >= 4 && game.users.entities[i].active)
				return game.users.entities[i].data._id;
		}
		ui.notifications.error("No GM available for Dancing Lights!");
	}

	static async sendRequest(req, tokenId) {
		req.sceneId = canvas.scene._id
		req.tokenId = tokenId;

		if (!game.user.isGM) {
			req.addressTo = TorchLight.firstGM();
			game.socket.emit("module.torch", req);
		}
		else {
			TorchLight.handleSocketRequest(req);
		}
	}

	static async addTorchLightButtons(app, html, data) {	
		const token = app.object.document;
		// Get the position of the column
		let position = game.settings.get('torchlight', 'position');

		// Create the column
		let buttonsdiv =  $(`<div class="col torchlight-column-${position}"></div>`);

		// Wrap the previous icons
		let newdiv = '<div class="torchlight-container"></div>';
		html.find('.col.left').before(newdiv);

		// Add the column
		html.find('.torchlight-container').prepend(buttonsdiv);


		console.log("Initialisation");

		// Get the status of the three types of lights
		let statusLight = token.getFlag("torchlight", "lightStatus");
		if (statusLight == undefined || statusLight == null) {
			statusLight = false;
			await token.setFlag("torchlight", "lightStatus", false);
		}
		let statusLantern = token.getFlag("torchlight", "lanternStatus");
		if (statusLantern == undefined || statusLantern == null) {
			await token.setFlag("torchlight", "lanternStatus", false);
		}
		let statusTorch = token.getFlag("torchlight", "torchStatus");
		if (statusTorch == undefined || statusTorch == null) {
			await token.setFlag("torchlight", "torchStatus", false);
		}

		// Initial button state when the HUD comes up
		if (statusLight) TorchLight.buttons.light.addClass("active");
		if (statusLantern) TorchLight.buttons.lantern.addClass("active");
		if (statusTorch) TorchLight.buttons.torch.addClass("active");

		// Check the permissions to manage the lights
		if (data.isGM === true || game.settings.get("torchlight", "playerActivation") === true) {

			// If the a specific light is on, enable only that light otherwise enable all three of them
			if (token.getFlag("torchlight", "lightStatus")) {
				TorchLight.enableTorchlightButton(TorchLight.buttons.light, token);
				TorchLight.disableTorchlightButton(TorchLight.buttons.lantern);
				TorchLight.disableTorchlightButton(TorchLight.buttons.torch);
				TorchLight.buttons.light.addClass("active");
			} else if (token.getFlag("torchlight", "lanternStatus")) {
				TorchLight.disableTorchlightButton(TorchLight.buttons.light);
				TorchLight.enableTorchlightButton(TorchLight.buttons.lantern, token);
				TorchLight.disableTorchlightButton(TorchLight.buttons.torch);
				TorchLight.buttons.lantern.addClass("active");
			} else if (token.getFlag("torchlight", "torchStatus")) {
				TorchLight.disableTorchlightButton(TorchLight.buttons.light);
				TorchLight.disableTorchlightButton(TorchLight.buttons.lantern);
				TorchLight.enableTorchlightButton(TorchLight.buttons.torch, token);
				TorchLight.buttons.torch.addClass("active");
			} else
				TorchLight.enableRelevantButtons(token);
		} else {
			TorchLight.disableTorchlightButton(TorchLight.buttons.light);
			TorchLight.disableTorchlightButton(TorchLight.buttons.lantern);
			TorchLight.disableTorchlightButton(TorchLight.buttons.torch);
		}

		// Finally insert the buttons in the column
		html.find('.col.torchlight-column-'+position).prepend(TorchLight.buttons.torch);
		html.find('.col.torchlight-column-'+position).prepend(TorchLight.buttons.lantern);
		html.find('.col.torchlight-column-'+position).prepend(TorchLight.buttons.light);
	}

	static async handleSocketRequest(req) {
		if (req.addressTo === undefined || req.addressTo === game.user._id) {
			let scn = game.scenes.get(req.sceneId);
			let tkn = scn.data.tokens.find(({_id}) => _id === req.tokenId);
			let dltoks=[];

			switch(req.requestType) {
				case 'removeDancingLights':
					scn.data.tokens.forEach(tok => {
						if (tok.actorId === tkn.actorId &&
						    tok.name === 'Dancing Light' &&
						    tok.dimLight === 20 &&
						    tok.brightLight === 10) {
							//let dltok = canvas.tokens.get(tok._id);
							dltoks.push(scn.getEmbeddedEntity("Token", tok._id)._id);
						}
					});
					await scn.deleteEmbeddedEntity("Token", dltoks);
					break;
			}
		}
	}
}

// Handlers
Hooks.on('ready', () => {
	// Call addTorchlightButtons() when the Token HUD is rendered
	Hooks.on('renderTokenHUD', (app, html, data) => { TorchLight.addTorchLightButtons(app, html, data) });
	Hooks.on('renderControlsReference', (app, html, data) => {
		html.find('div').first().append('<h3>TorchLight</h3><ol class="hotkey-list"><li><h4>'+
			game.i18n.localize("torchlight.turnOffAllLights")+
			'</h4><div class="keys">'+
			game.i18n.localize("torchlight.holdCtrlOnClick")+
			'</div></li></ol>');
	});
	game.socket.on("module.torch", request => {
		TorchLight.handleSocketRequest(request);
	});
});

// Register module options at start-up
Hooks.once("init", () => {
	game.settings.register('torchlight', 'position', {
		name: game.i18n.localize("torchlight.position.name"),
		hint: game.i18n.localize("torchlight.position.hint"),
		scope: "world",
		config: true,
		type: String,
		default: "left",
		choices: {
			"left": game.i18n.localize("torchlight.position.left"),
			"right": game.i18n.localize("torchlight.position.right"),
			"top": game.i18n.localize("torchlight.position.top"),
			"bottom": game.i18n.localize("torchlight.position.bottom"),
		}
	});
	game.settings.register("torchlight", "playerActivation", {
		name: game.i18n.localize("torchlight.playerActivation.name"),
		hint: game.i18n.localize("torchlight.playerActivation.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});

	if (game.system.id === 'dnd5e') {
		game.settings.register("torchlight", "checkAvailability", {
			name: game.i18n.localize("torchlight.checkAvailability.name"),
			hint: game.i18n.localize("torchlight.checkAvailability.hint"),
			scope: "world",
			config: true,
			default: true,
			type: Boolean
		});
		game.settings.register("torchlight", "consumeItem", {
			name: game.i18n.localize("torchlight.consumeItem.name"),
			hint: game.i18n.localize("torchlight.consumeItem.hint"),
			scope: "world",
			config: true,
			default: true,
			type: Boolean
		});
		game.settings.register("torchlight", "dmAsPlayer", {
			name: game.i18n.localize("torchlight.dmAsPlayer.name"),
			hint: game.i18n.localize("torchlight.dmAsPlayer.hint"),
			scope: "world",
			config: true,
			default: false,
			type: Boolean
		});
	}

	// Light Parameters
	game.settings.register("torchlight", "lightBrightRadius", {
		name: game.i18n.localize("torchlight.lightBrightRadius.name"),
		hint: game.i18n.localize("torchlight.lightBrightRadius.hint"),
		scope: "world",
		config: true,
		default: 20,
		type: Number
	});
	game.settings.register("torchlight", "lightDimRadius", {
		name: game.i18n.localize("torchlight.lightDimRadius.name"),
		hint: game.i18n.localize("torchlight.lightDimRadius.hint"),
		scope: "world",
		config: true,
		default: 40,
		type: Number
	});
	game.settings.register("torchlight", "lightDuration", {
		name: game.i18n.localize("torchlight.lightDuration.name"),
		hint: game.i18n.localize("torchlight.lightDuration.hint"),
		scope: "world",
		config: true,
		default: 10,
		type: Number
	});
	game.settings.register('torchlight', 'lightType', {
		name: game.i18n.localize("torchlight.lightType.name"),
		hint: game.i18n.localize("torchlight.lightType.hint"),
		scope: "world",
		config: true,
		type: String,
		default: "Type1",
		choices: {
			"Type0": game.i18n.localize("torchlight.lightType.type0"),
			"Type1": game.i18n.localize("torchlight.lightType.type1"),
			"Type2": game.i18n.localize("torchlight.lightType.type2"),
			"Type3": game.i18n.localize("torchlight.lightType.type3"),
			"Type4": game.i18n.localize("torchlight.lightType.type4"),
			"Type5": game.i18n.localize("torchlight.lightType.type5"),
			"Type6": game.i18n.localize("torchlight.lightType.type6"),
			"Type7": game.i18n.localize("torchlight.lightType.type7"),
			"Type8": game.i18n.localize("torchlight.lightType.type8"),
			"Type9": game.i18n.localize("torchlight.lightType.type9"),
			"Type10": game.i18n.localize("torchlight.lightType.type10"),
			"Type11": game.i18n.localize("torchlight.lightType.type11"),
			"Type12": game.i18n.localize("torchlight.lightType.type12"),
			"Type13": game.i18n.localize("torchlight.lightType.type13"),
			"Type14": game.i18n.localize("torchlight.lightType.type14"),
			"Type15": game.i18n.localize("torchlight.lightType.type15"),
			"TypeC": game.i18n.localize("torchlight.lightType.typeC"),
		}
	});

	game.settings.register("torchlight", "customLightColor", {
		name: game.i18n.localize("torchlight.lightType.customColor.name"),
		hint: game.i18n.localize("torchlight.lightType.customColor.hint"),
		scope: "world",
		config: true,
		restricted: false,
		type: String,
		default: "#a2642a"
	});
	game.settings.register("torchlight", "customLightColorIntensity", {
		name: game.i18n.localize("torchlight.lightType.customIntensity.name"),
		hint: game.i18n.localize("torchlight.lightType.customIntensity.hint"),
		scope: "world",
		config: true,
		restricted: true,
		type: Number,
		default: 0.5,
		range: {
			min: 0.0,
			step: 0.05,
			max: 1,
		}
	});
	game.settings.register('torchlight', 'customLightAnimationType', {
		name: game.i18n.localize("torchlight.lightType.customAnimationType.name"),
		hint: game.i18n.localize("torchlight.lightType.customAnimationType.hint"),
		scope: "world",
		config: true,
		type: String,
		default: "none",
		choices: {
			"none": game.i18n.localize("torchlight.animationType.none"),
			"torch": game.i18n.localize("torchlight.animationType.torch"),
			"pulse": game.i18n.localize("torchlight.animationType.pulse"),
			"chroma": game.i18n.localize("torchlight.animationType.chroma"),
			"wave": game.i18n.localize("torchlight.animationType.wave"),
			"fog": game.i18n.localize("torchlight.animationType.fog"),
			"sunburst": game.i18n.localize("torchlight.animationType.sunburst"),
			"dome": game.i18n.localize("torchlight.animationType.dome"),
			"emanation": game.i18n.localize("torchlight.animationType.emanation"),
			"hexa": game.i18n.localize("torchlight.animationType.hexa"),
			"ghost": game.i18n.localize("torchlight.animationType.ghost"),
			"energy": game.i18n.localize("torchlight.animationType.energy"),
			"roiling": game.i18n.localize("torchlight.animationType.roiling"),
			"hole": game.i18n.localize("torchlight.animationType.hole"),
		}
	});
	game.settings.register("torchlight", "customLightAnimationSpeed", {
		name: game.i18n.localize("torchlight.lightType.customAnimationSpeed.name"),
		hint: game.i18n.localize("torchlight.lightType.customAnimationSpeed.hint"),
		scope: "world",
		config: true,
		restricted: true,
		type: Number,
		default: 5,
		range: {
			min: 1,
			step: 1,
			max: 10,
		}
	});
	game.settings.register("torchlight", "customLightAnimationIntensity", {
		name: game.i18n.localize("torchlight.lightType.customAnimationIntensity.name"),
		hint: game.i18n.localize("torchlight.lightType.customAnimationIntensity.hint"),
		scope: "world",
		config: true,
		restricted: true,
		type: Number,
		default: 5,
		range: {
			min: 1,
			step: 1,
			max: 10,
		}
	});




	// Lantern Parameters
	game.settings.register("torchlight", "lanternBrightRadius", {
		name: game.i18n.localize("torchlight.lanternBrightRadius.name"),
		hint: game.i18n.localize("torchlight.lanternBrightRadius.hint"),
		scope: "world",
		config: true,
		default: 30,
		type: Number
	});
	game.settings.register("torchlight", "lanternDimRadius", {
		name: game.i18n.localize("torchlight.lanternDimRadius.name"),
		hint: game.i18n.localize("torchlight.lanternDimRadius.hint"),
		scope: "world",
		config: true,
		default: 60,
		type: Number
	});
	game.settings.register("torchlight", "lanternDuration", {
		name: game.i18n.localize("torchlight.lanternDuration.name"),
		hint: game.i18n.localize("torchlight.lanternDuration.hint"),
		scope: "world",
		config: true,
		default: 360,
		type: Number
	});
	game.settings.register('torchlight', 'lanternType', {
		name: game.i18n.localize("torchlight.lanternType.name"),
		hint: game.i18n.localize("torchlight.lanternType.hint"),
		scope: "world",
		config: true,
		type: String,
		default: "Type1",
		choices: {
			"Type0": game.i18n.localize("torchlight.lanternType.type0"),
			"Type1": game.i18n.localize("torchlight.lanternType.type1"),
			"Type2": game.i18n.localize("torchlight.lanternType.type2"),
			"Type3": game.i18n.localize("torchlight.lanternType.type3"),
			"Type4": game.i18n.localize("torchlight.lanternType.type4"),
			"Type5": game.i18n.localize("torchlight.lanternType.type5"),
			"Type6": game.i18n.localize("torchlight.lanternType.type6"),
			"Type7": game.i18n.localize("torchlight.lanternType.type7"),
			"Type8": game.i18n.localize("torchlight.lanternType.type8"),
			"Type9": game.i18n.localize("torchlight.lanternType.type9"),
			"TypeC": game.i18n.localize("torchlight.lanternType.typeC"),
		}
	});


	game.settings.register("torchlight", "customLanternColor", {
		name: game.i18n.localize("torchlight.lanternType.customColor.name"),
		hint: game.i18n.localize("torchlight.lanternType.customColor.hint"),
		scope: "world",
		config: true,
		restricted: false,
		type: String,
		default: "#a2642a"
	});
	game.settings.register("torchlight", "customLanternColorIntensity", {
		name: game.i18n.localize("torchlight.lanternType.customIntensity.name"),
		hint: game.i18n.localize("torchlight.lanternType.customIntensity.hint"),
		scope: "world",
		config: true,
		restricted: true,
		type: Number,
		default: 0.5,
		range: {
			min: 0.0,
			step: 0.05,
			max: 1,
		}
	});
	game.settings.register('torchlight', 'customLanternAnimationType', {
		name: game.i18n.localize("torchlight.lanternType.customAnimationType.name"),
		hint: game.i18n.localize("torchlight.lanternType.customAnimationType.hint"),
		scope: "world",
		config: true,
		type: String,
		default: "none",
		choices: {
			"none": game.i18n.localize("torchlight.animationType.none"),
			"torch": game.i18n.localize("torchlight.animationType.torch"),
			"pulse": game.i18n.localize("torchlight.animationType.pulse"),
			"chroma": game.i18n.localize("torchlight.animationType.chroma"),
			"wave": game.i18n.localize("torchlight.animationType.wave"),
			"fog": game.i18n.localize("torchlight.animationType.fog"),
			"sunburst": game.i18n.localize("torchlight.animationType.sunburst"),
			"dome": game.i18n.localize("torchlight.animationType.dome"),
			"emanation": game.i18n.localize("torchlight.animationType.emanation"),
			"hexa": game.i18n.localize("torchlight.animationType.hexa"),
			"ghost": game.i18n.localize("torchlight.animationType.ghost"),
			"energy": game.i18n.localize("torchlight.animationType.energy"),
			"roiling": game.i18n.localize("torchlight.animationType.roiling"),
			"hole": game.i18n.localize("torchlight.animationType.hole"),
		}
	});
	game.settings.register("torchlight", "customLanternAnimationSpeed", {
		name: game.i18n.localize("torchlight.lanternType.customAnimationSpeed.name"),
		hint: game.i18n.localize("torchlight.lanternType.customAnimationSpeed.hint"),
		scope: "world",
		config: true,
		restricted: true,
		type: Number,
		default: 5,
		range: {
			min: 1,
			step: 1,
			max: 10,
		}
	});
	game.settings.register("torchlight", "customLanternAnimationIntensity", {
		name: game.i18n.localize("torchlight.lanternType.customAnimationIntensity.name"),
		hint: game.i18n.localize("torchlight.lanternType.customAnimationIntensity.hint"),
		scope: "world",
		config: true,
		restricted: true,
		type: Number,
		default: 5,
		range: {
			min: 1,
			step: 1,
			max: 10,
		}
	});



	if (game.system.id === 'dnd5e') {
		game.settings.register("torchlight", "nameConsumableLantern", {
			name: game.i18n.localize("torchlight.nameConsumableLantern.name"),
			hint: game.i18n.localize("torchlight.nameConsumableLantern.hint"),
			scope: "world",
			config: true,
			default: "Oil (flask)",
			type: String
		});
	}

	// Torch Parameters
	game.settings.register("torchlight", "torchBrightRadius", {
		name: game.i18n.localize("torchlight.torchBrightRadius.name"),
		hint: game.i18n.localize("torchlight.torchBrightRadius.hint"),
		scope: "world",
		config: true,
		default: 20,
		type: Number
	});
	game.settings.register("torchlight", "torchDimRadius", {
		name: game.i18n.localize("torchlight.torchDimRadius.name"),
		hint: game.i18n.localize("torchlight.torchDimRadius.hint"),
		scope: "world",
		config: true,
		default: 40,
		type: Number
	});
	game.settings.register("torchlight", "torchDuration", {
		name: game.i18n.localize("torchlight.torchDuration.name"),
		hint: game.i18n.localize("torchlight.torchDuration.hint"),
		scope: "world",
		config: true,
		default: 60,
		type: Number
	});
	game.settings.register('torchlight', 'torchType', {
		name: game.i18n.localize("torchlight.torchType.name"),
		hint: game.i18n.localize("torchlight.torchType.hint"),
		scope: "world",
		config: true,
		type: String,
		default: "Type1",
		choices: {
			"Type0": game.i18n.localize("torchlight.torchType.type0"),
			"Type1": game.i18n.localize("torchlight.torchType.type1"),
			"Type2": game.i18n.localize("torchlight.torchType.type2"),
			"Type3": game.i18n.localize("torchlight.torchType.type3"),
			"Type4": game.i18n.localize("torchlight.torchType.type4"),
			"Type5": game.i18n.localize("torchlight.torchType.type5"),
			"Type6": game.i18n.localize("torchlight.torchType.type6"),
			"Type7": game.i18n.localize("torchlight.torchType.type7"),
			"Type8": game.i18n.localize("torchlight.torchType.type8"),
			"Type9": game.i18n.localize("torchlight.torchType.type9"),
			"TypeC": game.i18n.localize("torchlight.torchType.typeC"),
		}
	});


	game.settings.register("torchlight", "customTorchColor", {
		name: game.i18n.localize("torchlight.torchType.customColor.name"),
		hint: game.i18n.localize("torchlight.torchType.customColor.hint"),
		scope: "world",
		config: true,
		restricted: false,
		type: String,
		default: "#a2642a"
	});
	game.settings.register("torchlight", "customTorchColorIntensity", {
		name: game.i18n.localize("torchlight.torchType.customIntensity.name"),
		hint: game.i18n.localize("torchlight.torchType.customIntensity.hint"),
		scope: "world",
		config: true,
		restricted: true,
		type: Number,
		default: 0.5,
		range: {
			min: 0.0,
			step: 0.05,
			max: 1,
		}
	});
	game.settings.register('torchlight', 'customTorchAnimationType', {
		name: game.i18n.localize("torchlight.torchType.customAnimationType.name"),
		hint: game.i18n.localize("torchlight.torchType.customAnimationType.hint"),
		scope: "world",
		config: true,
		type: String,
		default: "none",
		choices: {
			"none": game.i18n.localize("torchlight.animationType.none"),
			"torch": game.i18n.localize("torchlight.animationType.torch"),
			"pulse": game.i18n.localize("torchlight.animationType.pulse"),
			"chroma": game.i18n.localize("torchlight.animationType.chroma"),
			"wave": game.i18n.localize("torchlight.animationType.wave"),
			"fog": game.i18n.localize("torchlight.animationType.fog"),
			"sunburst": game.i18n.localize("torchlight.animationType.sunburst"),
			"dome": game.i18n.localize("torchlight.animationType.dome"),
			"emanation": game.i18n.localize("torchlight.animationType.emanation"),
			"hexa": game.i18n.localize("torchlight.animationType.hexa"),
			"ghost": game.i18n.localize("torchlight.animationType.ghost"),
			"energy": game.i18n.localize("torchlight.animationType.energy"),
			"roiling": game.i18n.localize("torchlight.animationType.roiling"),
			"hole": game.i18n.localize("torchlight.animationType.hole"),
		}
	});
	game.settings.register("torchlight", "customTorchAnimationSpeed", {
		name: game.i18n.localize("torchlight.torchType.customAnimationSpeed.name"),
		hint: game.i18n.localize("torchlight.torchType.customAnimationSpeed.hint"),
		scope: "world",
		config: true,
		restricted: true,
		type: Number,
		default: 5,
		range: {
			min: 1,
			step: 1,
			max: 10,
		}
	});
	game.settings.register("torchlight", "customTorchAnimationIntensity", {
		name: game.i18n.localize("torchlight.torchType.customAnimationIntensity.name"),
		hint: game.i18n.localize("torchlight.torchType.customAnimationIntensity.hint"),
		scope: "world",
		config: true,
		restricted: true,
		type: Number,
		default: 5,
		range: {
			min: 1,
			step: 1,
			max: 10,
		}
	});


	if (game.system.id === 'dnd5e') {
		game.settings.register("torchlight", "nameConsumableTorch", {
			name: game.i18n.localize("torchlight.nameConsumableTorch.name"),
			hint: game.i18n.localize("torchlight.nameConsumableTorch.hint"),
			scope: "world",
			config: true,
			default: "Torch",
			type: String
		});
	}
});

console.log("--- Flame on!");
