define(["require", "exports", "./createElements", "./sidebar/runtime", "./exporter", "./createUI", "./getExample", "./monaco/ExampleHighlight", "./createConfigDropdown", "./sidebar/plugins", "./pluginUtils", "./sidebar/settings"], function (require, exports, createElements_1, runtime_1, exporter_1, createUI_1, getExample_1, ExampleHighlight_1, createConfigDropdown_1, plugins_1, pluginUtils_1, settings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.setupPlayground = void 0;
    exports.setupPlayground = (sandbox, monaco, config, i, react) => {
        const playgroundParent = sandbox.getDomNode().parentElement.parentElement.parentElement;
        const dragBar = createElements_1.createDragBar();
        playgroundParent.appendChild(dragBar);
        const sidebar = createElements_1.createSidebar();
        playgroundParent.appendChild(sidebar);
        const tabBar = createElements_1.createTabBar();
        sidebar.appendChild(tabBar);
        const container = createElements_1.createPluginContainer();
        sidebar.appendChild(container);
        const plugins = [];
        const tabs = [];
        // Let's things like the workbench hook into tab changes
        let didUpdateTab;
        const registerPlugin = (plugin) => {
            plugins.push(plugin);
            const tab = createElements_1.createTabForPlugin(plugin);
            tabs.push(tab);
            const tabClicked = e => {
                const previousPlugin = getCurrentPlugin();
                let newTab = e.target;
                // It could be a notification you clicked on
                if (newTab.tagName === "DIV")
                    newTab = newTab.parentElement;
                const newPlugin = plugins.find(p => `playground-plugin-tab-${p.id}` == newTab.id);
                createElements_1.activatePlugin(newPlugin, previousPlugin, sandbox, tabBar, container);
                didUpdateTab && didUpdateTab(newPlugin, previousPlugin);
            };
            tabBar.appendChild(tab);
            tab.onclick = tabClicked;
        };
        const setDidUpdateTab = (func) => {
            didUpdateTab = func;
        };
        const getCurrentPlugin = () => {
            const selectedTab = tabs.find(t => t.classList.contains("active"));
            return plugins[tabs.indexOf(selectedTab)];
        };
        const defaultPlugins = config.plugins || settings_1.getPlaygroundPlugins();
        const utils = pluginUtils_1.createUtils(sandbox, react);
        const initialPlugins = defaultPlugins.map(f => f(i, utils));
        initialPlugins.forEach(p => registerPlugin(p));
        // Choose which should be selected
        const priorityPlugin = plugins.find(plugin => plugin.shouldBeSelected && plugin.shouldBeSelected());
        const selectedPlugin = priorityPlugin || plugins[0];
        const selectedTab = tabs[plugins.indexOf(selectedPlugin)];
        selectedTab.onclick({ target: selectedTab });
        let debouncingTimer = false;
        sandbox.editor.onDidChangeModelContent(_event => {
            const plugin = getCurrentPlugin();
            if (plugin.modelChanged)
                plugin.modelChanged(sandbox, sandbox.getModel(), container);
            // This needs to be last in the function
            if (debouncingTimer)
                return;
            debouncingTimer = true;
            setTimeout(() => {
                debouncingTimer = false;
                playgroundDebouncedMainFunction();
                // Only call the plugin function once every 0.3s
                if (plugin.modelChangedDebounce && plugin.id === getCurrentPlugin().id) {
                    plugin.modelChangedDebounce(sandbox, sandbox.getModel(), container);
                }
            }, 300);
        });
        // If you set this to true, then the next time the playground would
        // have set the user's hash it would be skipped - used for setting
        // the text in examples
        let suppressNextTextChangeForHashChange = false;
        // Sets the URL and storage of the sandbox string
        const playgroundDebouncedMainFunction = () => {
            const alwaysUpdateURL = !localStorage.getItem("disable-save-on-type");
            if (alwaysUpdateURL) {
                if (suppressNextTextChangeForHashChange) {
                    suppressNextTextChangeForHashChange = false;
                    return;
                }
                const newURL = sandbox.createURLQueryWithCompilerOptions(sandbox);
                window.history.replaceState({}, "", newURL);
            }
            localStorage.setItem("sandbox-history", sandbox.getText());
        };
        // When any compiler flags are changed, trigger a potential change to the URL
        sandbox.setDidUpdateCompilerSettings(() => {
            playgroundDebouncedMainFunction();
            // @ts-ignore
            window.appInsights && window.appInsights.trackEvent({ name: "Compiler Settings changed" });
            const model = sandbox.editor.getModel();
            const plugin = getCurrentPlugin();
            if (model && plugin.modelChanged)
                plugin.modelChanged(sandbox, model, container);
            if (model && plugin.modelChangedDebounce)
                plugin.modelChangedDebounce(sandbox, model, container);
        });
        const skipInitiallySettingHash = document.location.hash && document.location.hash.includes("example/");
        if (!skipInitiallySettingHash)
            playgroundDebouncedMainFunction();
        // Setup working with the existing UI, once it's loaded
        // Versions of TypeScript
        // Set up the label for the dropdown
        const versionButton = document.querySelectorAll("#versions > a").item(0);
        versionButton.innerHTML = "v" + sandbox.ts.version + " <span class='caret'/>";
        versionButton.setAttribute("aria-label", `Select version of TypeScript, currently ${sandbox.ts.version}`);
        // Add the versions to the dropdown
        const versionsMenu = document.querySelectorAll("#versions > ul").item(0);
        // Enable all submenus
        document.querySelectorAll("nav ul li").forEach(e => e.classList.add("active"));
        const notWorkingInPlayground = ["3.1.6", "3.0.1", "2.8.1", "2.7.2", "2.4.1"];
        const allVersions = [...sandbox.supportedVersions.filter(f => !notWorkingInPlayground.includes(f)), "Nightly"];
        allVersions.forEach((v) => {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.textContent = v;
            a.href = "#";
            if (v === "Nightly") {
                li.classList.add("nightly");
            }
            if (v.toLowerCase().includes("beta")) {
                li.classList.add("beta");
            }
            li.onclick = () => {
                const currentURL = sandbox.createURLQueryWithCompilerOptions(sandbox);
                const params = new URLSearchParams(currentURL.split("#")[0]);
                const version = v === "Nightly" ? "next" : v;
                params.set("ts", version);
                const hash = document.location.hash.length ? document.location.hash : "";
                const newURL = `${document.location.protocol}//${document.location.host}${document.location.pathname}?${params}${hash}`;
                // @ts-ignore - it is allowed
                document.location = newURL;
            };
            li.appendChild(a);
            versionsMenu.appendChild(li);
        });
        // Support dropdowns
        document.querySelectorAll(".navbar-sub li.dropdown > a").forEach(link => {
            const a = link;
            a.onclick = _e => {
                if (a.parentElement.classList.contains("open")) {
                    document.querySelectorAll(".navbar-sub li.open").forEach(i => i.classList.remove("open"));
                    a.setAttribute("aria-expanded", "false");
                }
                else {
                    document.querySelectorAll(".navbar-sub li.open").forEach(i => i.classList.remove("open"));
                    a.parentElement.classList.toggle("open");
                    a.setAttribute("aria-expanded", "true");
                    const exampleContainer = a.closest("li").getElementsByTagName("ul").item(0);
                    const firstLabel = exampleContainer.querySelector("label");
                    if (firstLabel)
                        firstLabel.focus();
                    // Set exact height and widths for the popovers for the main playground navigation
                    const isPlaygroundSubmenu = !!a.closest("nav");
                    if (isPlaygroundSubmenu) {
                        const playgroundContainer = document.getElementById("playground-container");
                        exampleContainer.style.height = `calc(${playgroundContainer.getBoundingClientRect().height + 26}px - 4rem)`;
                        const sideBarWidth = document.querySelector(".playground-sidebar").offsetWidth;
                        exampleContainer.style.width = `calc(100% - ${sideBarWidth}px - 71px)`;
                        // All this is to make sure that tabbing stays inside the dropdown for tsconfig/examples
                        const buttons = exampleContainer.querySelectorAll("input");
                        const lastButton = buttons.item(buttons.length - 1);
                        if (lastButton) {
                            redirectTabPressTo(lastButton, exampleContainer, ".examples-close");
                        }
                        else {
                            const sections = document.querySelectorAll("ul.examples-dropdown .section-content");
                            sections.forEach(s => {
                                const buttons = s.querySelectorAll("a.example-link");
                                const lastButton = buttons.item(buttons.length - 1);
                                if (lastButton) {
                                    redirectTabPressTo(lastButton, exampleContainer, ".examples-close");
                                }
                            });
                        }
                    }
                }
                return false;
            };
        });
        // Handle escape closing dropdowns etc
        document.onkeydown = function (evt) {
            evt = evt || window.event;
            var isEscape = false;
            if ("key" in evt) {
                isEscape = evt.key === "Escape" || evt.key === "Esc";
            }
            else {
                // @ts-ignore - this used to be the case
                isEscape = evt.keyCode === 27;
            }
            if (isEscape) {
                document.querySelectorAll(".navbar-sub li.open").forEach(i => i.classList.remove("open"));
                document.querySelectorAll(".navbar-sub li").forEach(i => i.setAttribute("aria-expanded", "false"));
            }
        };
        const shareAction = {
            id: "copy-clipboard",
            label: "Save to clipboard",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
            contextMenuGroupId: "run",
            contextMenuOrder: 1.5,
            run: function () {
                window.navigator.clipboard.writeText(location.href.toString()).then(() => ui.flashInfo(i("play_export_clipboard")), (e) => alert(e));
            },
        };
        const shareButton = document.getElementById("share-button");
        if (shareButton) {
            shareButton.onclick = e => {
                e.preventDefault();
                shareAction.run();
                return false;
            };
            // Set up some key commands
            sandbox.editor.addAction(shareAction);
            sandbox.editor.addAction({
                id: "run-js",
                label: "Run the evaluated JavaScript for your TypeScript file",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
                contextMenuGroupId: "run",
                contextMenuOrder: 1.5,
                run: function (ed) {
                    const runButton = document.getElementById("run-button");
                    runButton && runButton.onclick && runButton.onclick({});
                },
            });
        }
        const runButton = document.getElementById("run-button");
        if (runButton) {
            runButton.onclick = () => {
                const run = sandbox.getRunnableJS();
                const runPlugin = plugins.find(p => p.id === "logs");
                createElements_1.activatePlugin(runPlugin, getCurrentPlugin(), sandbox, tabBar, container);
                runtime_1.runWithCustomLogs(run, i);
                const isJS = sandbox.config.useJavaScript;
                ui.flashInfo(i(isJS ? "play_run_js" : "play_run_ts"));
                return false;
            };
        }
        // Handle the close buttons on the examples
        document.querySelectorAll("button.examples-close").forEach(b => {
            const button = b;
            button.onclick = (e) => {
                const button = e.target;
                const navLI = button.closest("li");
                navLI === null || navLI === void 0 ? void 0 : navLI.classList.remove("open");
            };
        });
        createElements_1.setupSidebarToggle();
        if (document.getElementById("config-container")) {
            createConfigDropdown_1.createConfigDropdown(sandbox, monaco);
            createConfigDropdown_1.updateConfigDropdownForCompilerOptions(sandbox, monaco);
        }
        if (document.getElementById("playground-settings")) {
            const settingsToggle = document.getElementById("playground-settings");
            settingsToggle.onclick = () => {
                const open = settingsToggle.parentElement.classList.contains("open");
                const sidebarTabs = document.querySelector(".playground-plugin-tabview");
                const sidebarContent = document.querySelector(".playground-plugin-container");
                let settingsContent = document.querySelector(".playground-settings-container");
                if (!settingsContent) {
                    settingsContent = document.createElement("div");
                    settingsContent.className = "playground-settings-container playground-plugin-container";
                    const settings = settings_1.settingsPlugin(i, utils);
                    settings.didMount && settings.didMount(sandbox, settingsContent);
                    document.querySelector(".playground-sidebar").appendChild(settingsContent);
                    // When the last tab item is hit, go back to the settings button
                    const labels = document.querySelectorAll(".playground-sidebar input");
                    const lastLabel = labels.item(labels.length - 1);
                    if (lastLabel) {
                        redirectTabPressTo(lastLabel, undefined, "#playground-settings");
                    }
                }
                if (open) {
                    sidebarTabs.style.display = "flex";
                    sidebarContent.style.display = "block";
                    settingsContent.style.display = "none";
                }
                else {
                    sidebarTabs.style.display = "none";
                    sidebarContent.style.display = "none";
                    settingsContent.style.display = "block";
                    document.querySelector(".playground-sidebar label").focus();
                }
                settingsToggle.parentElement.classList.toggle("open");
            };
            settingsToggle.addEventListener("keydown", e => {
                const isOpen = settingsToggle.parentElement.classList.contains("open");
                if (e.keyCode === 9 && isOpen) {
                    const result = document.querySelector(".playground-options li input");
                    result.focus();
                    e.preventDefault();
                }
            });
        }
        // Support grabbing examples from the location hash
        if (location.hash.startsWith("#example")) {
            const exampleName = location.hash.replace("#example/", "").trim();
            sandbox.config.logger.log("Loading example:", exampleName);
            getExample_1.getExampleSourceCode(config.prefix, config.lang, exampleName).then(ex => {
                if (ex.example && ex.code) {
                    const { example, code } = ex;
                    // Update the localstorage showing that you've seen this page
                    if (localStorage) {
                        const seenText = localStorage.getItem("examples-seen") || "{}";
                        const seen = JSON.parse(seenText);
                        seen[example.id] = example.hash;
                        localStorage.setItem("examples-seen", JSON.stringify(seen));
                    }
                    const allLinks = document.querySelectorAll("example-link");
                    // @ts-ignore
                    for (const link of allLinks) {
                        if (link.textContent === example.title) {
                            link.classList.add("highlight");
                        }
                    }
                    document.title = "TypeScript Playground - " + example.title;
                    suppressNextTextChangeForHashChange = true;
                    sandbox.setText(code);
                }
                else {
                    suppressNextTextChangeForHashChange = true;
                    sandbox.setText("// There was an issue getting the example, bad URL? Check the console in the developer tools");
                }
            });
        }
        // This isn't optimal, but it's good enough without me adding support
        // for https://github.com/microsoft/monaco-editor/issues/313
        setInterval(() => {
            const markers = sandbox.monaco.editor.getModelMarkers({});
            utils.setNotifications("errors", markers.length);
        }, 500);
        // Sets up a way to click between examples
        monaco.languages.registerLinkProvider(sandbox.language, new ExampleHighlight_1.ExampleHighlighter());
        const languageSelector = document.getElementById("language-selector");
        if (languageSelector) {
            const params = new URLSearchParams(location.search);
            languageSelector.options.selectedIndex = params.get("useJavaScript") ? 1 : 0;
            languageSelector.onchange = () => {
                const useJavaScript = languageSelector.value === "JavaScript";
                const query = sandbox.createURLQueryWithCompilerOptions(sandbox, {
                    useJavaScript: useJavaScript ? true : undefined,
                });
                const fullURL = `${document.location.protocol}//${document.location.host}${document.location.pathname}${query}`;
                // @ts-ignore
                document.location = fullURL;
            };
        }
        // Ensure that the editor is full-width when the screen resizes
        window.addEventListener("resize", () => {
            sandbox.editor.layout();
        });
        const ui = createUI_1.createUI();
        const exporter = exporter_1.createExporter(sandbox, monaco, ui);
        const playground = {
            exporter,
            ui,
            registerPlugin,
            plugins,
            getCurrentPlugin,
            tabs,
            setDidUpdateTab,
            createUtils: pluginUtils_1.createUtils,
        };
        window.ts = sandbox.ts;
        window.sandbox = sandbox;
        window.playground = playground;
        console.log(`Using TypeScript ${window.ts.version}`);
        console.log("Available globals:");
        console.log("\twindow.ts", window.ts);
        console.log("\twindow.sandbox", window.sandbox);
        console.log("\twindow.playground", window.playground);
        console.log("\twindow.react", window.react);
        console.log("\twindow.reactDOM", window.reactDOM);
        /** A plugin */
        const activateExternalPlugin = (plugin, autoActivate) => {
            let readyPlugin;
            // Can either be a factory, or object
            if (typeof plugin === "function") {
                const utils = pluginUtils_1.createUtils(sandbox, react);
                readyPlugin = plugin(utils);
            }
            else {
                readyPlugin = plugin;
            }
            if (autoActivate) {
                console.log(readyPlugin);
            }
            playground.registerPlugin(readyPlugin);
            // Auto-select the dev plugin
            const pluginWantsFront = readyPlugin.shouldBeSelected && readyPlugin.shouldBeSelected();
            if (pluginWantsFront || autoActivate) {
                // Auto-select the dev plugin
                createElements_1.activatePlugin(readyPlugin, getCurrentPlugin(), sandbox, tabBar, container);
            }
        };
        // Dev mode plugin
        if (config.supportCustomPlugins && plugins_1.allowConnectingToLocalhost()) {
            window.exports = {};
            console.log("Connecting to dev plugin");
            try {
                // @ts-ignore
                const re = window.require;
                re(["local/index"], (devPlugin) => {
                    console.log("Set up dev plugin from localhost:5000");
                    try {
                        activateExternalPlugin(devPlugin, true);
                    }
                    catch (error) {
                        console.error(error);
                        setTimeout(() => {
                            ui.flashInfo("Error: Could not load dev plugin from localhost:5000");
                        }, 700);
                    }
                });
            }
            catch (error) {
                console.error("Problem loading up the dev plugin");
                console.error(error);
            }
        }
        const downloadPlugin = (plugin, autoEnable) => {
            try {
                // @ts-ignore
                const re = window.require;
                re([`unpkg/${plugin}@latest/dist/index`], (devPlugin) => {
                    activateExternalPlugin(devPlugin, autoEnable);
                });
            }
            catch (error) {
                console.error("Problem loading up the plugin:", plugin);
                console.error(error);
            }
        };
        if (config.supportCustomPlugins) {
            // Grab ones from localstorage
            plugins_1.activePlugins().forEach(p => downloadPlugin(p.id, false));
            // Offer to install one if 'install-plugin' is a query param
            const params = new URLSearchParams(location.search);
            const pluginToInstall = params.get("install-plugin");
            if (pluginToInstall) {
                const alreadyInstalled = plugins_1.activePlugins().find(p => p.id === pluginToInstall);
                if (!alreadyInstalled) {
                    const shouldDoIt = confirm("Would you like to install the third party plugin?\n\n" + pluginToInstall);
                    if (shouldDoIt) {
                        plugins_1.addCustomPlugin(pluginToInstall);
                        downloadPlugin(pluginToInstall, true);
                    }
                }
            }
        }
        if (location.hash.startsWith("#show-examples")) {
            setTimeout(() => {
                var _a;
                (_a = document.getElementById("examples-button")) === null || _a === void 0 ? void 0 : _a.click();
            }, 100);
        }
        if (location.hash.startsWith("#show-whatisnew")) {
            setTimeout(() => {
                var _a;
                (_a = document.getElementById("whatisnew-button")) === null || _a === void 0 ? void 0 : _a.click();
            }, 100);
        }
        return playground;
    };
    const redirectTabPressTo = (element, container, query) => {
        element.addEventListener("keydown", e => {
            if (e.keyCode === 9) {
                const host = container || document;
                const result = host.querySelector(query);
                if (!result)
                    throw new Error(`Expected to find a result for keydown`);
                result.focus();
                e.preventDefault();
            }
        });
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wbGF5Z3JvdW5kL3NyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0lBc0VhLFFBQUEsZUFBZSxHQUFHLENBQzdCLE9BQWdCLEVBQ2hCLE1BQWMsRUFDZCxNQUF3QixFQUN4QixDQUEwQixFQUMxQixLQUFtQixFQUNuQixFQUFFO1FBQ0YsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUMsYUFBYyxDQUFDLGFBQWMsQ0FBQyxhQUFjLENBQUE7UUFDMUYsTUFBTSxPQUFPLEdBQUcsOEJBQWEsRUFBRSxDQUFBO1FBQy9CLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUVyQyxNQUFNLE9BQU8sR0FBRyw4QkFBYSxFQUFFLENBQUE7UUFDL0IsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBRXJDLE1BQU0sTUFBTSxHQUFHLDZCQUFZLEVBQUUsQ0FBQTtRQUM3QixPQUFPLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBRTNCLE1BQU0sU0FBUyxHQUFHLHNDQUFxQixFQUFFLENBQUE7UUFDekMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUU5QixNQUFNLE9BQU8sR0FBRyxFQUF3QixDQUFBO1FBQ3hDLE1BQU0sSUFBSSxHQUFHLEVBQXlCLENBQUE7UUFFdEMsd0RBQXdEO1FBQ3hELElBQUksWUFBaUcsQ0FBQTtRQUVyRyxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQXdCLEVBQUUsRUFBRTtZQUNsRCxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBRXBCLE1BQU0sR0FBRyxHQUFHLG1DQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBRXRDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7WUFFZCxNQUFNLFVBQVUsR0FBMkIs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LEdBQUcsRUFBRTs7Z0JBQ2QsTUFBQSxRQUFRLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLDBDQUFFLEtBQUssR0FBRTtZQUNyRCxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7U0FDUjtRQUVELElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsRUFBRTtZQUMvQyxVQUFVLENBQUMsR0FBRyxFQUFFOztnQkFDZCxNQUFBLFFBQVEsQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENBQUMsMENBQUUsS0FBSyxHQUFFO1lBQ3RELENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQTtTQUNSO1FBRUQsT0FBTyxVQUFVLENBQUE7SUFDbkIsQ0FBQyxDQUFBO0lBSUQsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLE9BQW9CLEVBQUUsU0FBa0MsRUFBRSxLQUFhLEVBQUUsRUFBRTtRQUNyRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ3RDLElBQUksQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLEVBQUU7Z0JBQ25CLE1BQU0sSUFBSSxHQUFHLFNBQVMsSUFBSSxRQUFRLENBQUE7Z0JBQ2xDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFRLENBQUE7Z0JBQy9DLElBQUksQ0FBQyxNQUFNO29CQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQTtnQkFDckUsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFBO2dCQUNkLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQTthQUNuQjtRQUNILENBQUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsidHlwZSBTYW5kYm94ID0gaW1wb3J0KFwidHlwZXNjcmlwdC1zYW5kYm94XCIpLlNhbmRib3hcbnR5cGUgTW9uYWNvID0gdHlwZW9mIGltcG9ydChcIm1vbmFjby1lZGl0b3JcIilcblxuZGVjbGFyZSBjb25zdCB3aW5kb3c6IGFueVxuXG5pbXBvcnQge1xuICBjcmVhdGVTaWRlYmFyLFxuICBjcmVhdGVUYWJGb3JQbHVnaW4sXG4gIGNyZWF0ZVRhYkJhcixcbiAgY3JlYXRlUGx1Z2luQ29udGFpbmVyLFxuICBhY3RpdmF0ZVBsdWdpbixcbiAgY3JlYXRlRHJhZ0JhcixcbiAgc2V0dXBTaWRlYmFyVG9nZ2xlLFxufSBmcm9tIFwiLi9jcmVhdGVFbGVtZW50c1wiXG5pbXBvcnQgeyBydW5XaXRoQ3VzdG9tTG9ncyB9IGZyb20gXCIuL3NpZGViYXIvcnVudGltZVwiXG5pbXBvcnQgeyBjcmVhdGVFeHBvcnRlciB9IGZyb20gXCIuL2V4cG9ydGVyXCJcbmltcG9ydCB7IGNyZWF0ZVVJIH0gZnJvbSBcIi4vY3JlYXRlVUlcIlxuaW1wb3J0IHsgZ2V0RXhhbXBsZVNvdXJjZUNvZGUgfSBmcm9tIFwiLi9nZXRFeGFtcGxlXCJcbmltcG9ydCB7IEV4YW1wbGVIaWdobGlnaHRlciB9IGZyb20gXCIuL21vbmFjby9FeGFtcGxlSGlnaGxpZ2h0XCJcbmltcG9ydCB7IGNyZWF0ZUNvbmZpZ0Ryb3Bkb3duLCB1cGRhdGVDb25maWdEcm9wZG93bkZvckNvbXBpbGVyT3B0aW9ucyB9IGZyb20gXCIuL2NyZWF0ZUNvbmZpZ0Ryb3Bkb3duXCJcbmltcG9ydCB7IGFsbG93Q29ubmVjdGluZ1RvTG9jYWxob3N0LCBhY3RpdmVQbHVnaW5zLCBhZGRDdXN0b21QbHVnaW4gfSBmcm9tIFwiLi9zaWRlYmFyL3BsdWdpbnNcIlxuaW1wb3J0IHsgY3JlYXRlVXRpbHMsIFBsdWdpblV0aWxzIH0gZnJvbSBcIi4vcGx1Z2luVXRpbHNcIlxuaW1wb3J0IHR5cGUgUmVhY3QgZnJvbSBcInJlYWN0XCJcbmltcG9ydCB7IHNldHRpbmdzUGx1Z2luLCBnZXRQbGF5Z3JvdW5kUGx1Z2lucyB9IGZyb20gXCIuL3NpZGViYXIvc2V0dGluZ3NcIlxuXG5leHBvcnQgeyBQbHVnaW5VdGlscyB9IGZyb20gXCIuL3BsdWdpblV0aWxzXCJcblxuZXhwb3J0IHR5cGUgUGx1Z2luRmFjdG9yeSA9IHtcbiAgKGk6IChrZXk6IHN0cmluZywgY29tcG9uZW50cz86IGFueSkgPT4gc3RyaW5nLCB1dGlsczogUGx1Z2luVXRpbHMpOiBQbGF5Z3JvdW5kUGx1Z2luXG59XG5cbi8qKiBUaGUgaW50ZXJmYWNlIG9mIGFsbCBzaWRlYmFyIHBsdWdpbnMgKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGxheWdyb3VuZFBsdWdpbiB7XG4gIC8qKiBOb3QgcHVibGljIGZhY2luZywgYnV0IHVzZWQgYnkgdGhlIHBsYXlncm91bmQgdG8gdW5pcXVlbHkgaWRlbnRpZnkgcGx1Z2lucyAqL1xuICBpZDogc3RyaW5nXG4gIC8qKiBUbyBzaG93IGluIHRoZSB0YWJzICovXG4gIGRpc3BsYXlOYW1lOiBzdHJpbmdcbiAgLyoqIFNob3VsZCB0aGlzIHBsdWdpbiBiZSBzZWxlY3RlZCB3aGVuIHRoZSBwbHVnaW4gaXMgZmlyc3QgbG9hZGVkPyBMZXRzIHlvdSBjaGVjayBmb3IgcXVlcnkgdmFycyBldGMgdG8gbG9hZCBhIHBhcnRpY3VsYXIgcGx1Z2luICovXG4gIHNob3VsZEJlU2VsZWN0ZWQ/OiAoKSA9PiBib29sZWFuXG4gIC8qKiBCZWZvcmUgd2Ugc2hvdyB0aGUgdGFiLCB1c2UgdGhpcyB0byBzZXQgdXAgeW91ciBIVE1MIC0gaXQgd2lsbCBhbGwgYmUgcmVtb3ZlZCBieSB0aGUgcGxheWdyb3VuZCB3aGVuIHNvbWVvbmUgbmF2aWdhdGVzIG9mZiB0aGUgdGFiICovXG4gIHdpbGxNb3VudD86IChzYW5kYm94OiBTYW5kYm94LCBjb250YWluZXI6IEhUTUxEaXZFbGVtZW50KSA9PiB2b2lkXG4gIC8qKiBBZnRlciB3ZSBzaG93IHRoZSB0YWIgKi9cbiAgZGlkTW91bnQ/OiAoc2FuZGJveDogU2FuZGJveCwgY29udGFpbmVyOiBIVE1MRGl2RWxlbWVudCkgPT4gdm9pZFxuICAvKiogTW9kZWwgY2hhbmdlcyB3aGlsZSB0aGlzIHBsdWdpbiBpcyBhY3RpdmVseSBzZWxlY3RlZCAgKi9cbiAgbW9kZWxDaGFuZ2VkPzogKHNhbmRib3g6IFNhbmRib3gsIG1vZGVsOiBpbXBvcnQoXCJtb25hY28tZWRpdG9yXCIpLmVkaXRvci5JVGV4dE1vZGVsLCBjb250YWluZXI6IEhUTUxEaXZFbGVtZW50KSA9PiB2b2lkXG4gIC8qKiBEZWxheWVkIG1vZGVsIGNoYW5nZXMgd2hpbGUgdGhpcyBwbHVnaW4gaXMgYWN0aXZlbHkgc2VsZWN0ZWQsIHVzZWZ1bCB3aGVuIHlvdSBhcmUgd29ya2luZyB3aXRoIHRoZSBUUyBBUEkgYmVjYXVzZSBpdCB3b24ndCBydW4gb24gZXZlcnkga2V5cHJlc3MgKi9cbiAgbW9kZWxDaGFuZ2VkRGVib3VuY2U/OiAoXG4gICAgc2FuZGJveDogU2FuZGJveCxcbiAgICBtb2RlbDogaW1wb3J0KFwibW9uYWNvLWVkaXRvclwiKS5lZGl0b3IuSVRleHRNb2RlbCxcbiAgICBjb250YWluZXI6IEhUTUxEaXZFbGVtZW50XG4gICkgPT4gdm9pZFxuICAvKiogQmVmb3JlIHdlIHJlbW92ZSB0aGUgdGFiICovXG4gIHdpbGxVbm1vdW50PzogKHNhbmRib3g6IFNhbmRib3gsIGNvbnRhaW5lcjogSFRNTERpdkVsZW1lbnQpID0+IHZvaWRcbiAgLyoqIEFmdGVyIHdlIHJlbW92ZSB0aGUgdGFiICovXG4gIGRpZFVubW91bnQ/OiAoc2FuZGJveDogU2FuZGJveCwgY29udGFpbmVyOiBIVE1MRGl2RWxlbWVudCkgPT4gdm9pZFxuICAvKiogQW4gb2JqZWN0IHlvdSBjYW4gdXNlIHRvIGtlZXAgZGF0YSBhcm91bmQgaW4gdGhlIHNjb3BlIG9mIHlvdXIgcGx1Z2luIG9iamVjdCAqL1xuICBkYXRhPzogYW55XG59XG5cbmludGVyZmFjZSBQbGF5Z3JvdW5kQ29uZmlnIHtcbiAgLyoqIExhbmd1YWdlIGxpa2UgXCJlblwiIC8gXCJqYVwiIGV0YyAqL1xuICBsYW5nOiBzdHJpbmdcbiAgLyoqIFNpdGUgcHJlZml4LCBsaWtlIFwidjJcIiBkdXJpbmcgdGhlIHByZS1yZWxlYXNlICovXG4gIHByZWZpeDogc3RyaW5nXG4gIC8qKiBPcHRpb25hbCBwbHVnaW5zIHNvIHRoYXQgd2UgY2FuIHJlLXVzZSB0aGUgcGxheWdyb3VuZCB3aXRoIGRpZmZlcmVudCBzaWRlYmFycyAqL1xuICBwbHVnaW5zPzogUGx1Z2luRmFjdG9yeVtdXG4gIC8qKiBTaG91bGQgdGhpcyBwbGF5Z3JvdW5kIGxvYWQgdXAgY3VzdG9tIHBsdWdpbnMgZnJvbSBsb2NhbFN0b3JhZ2U/ICovXG4gIHN1cHBvcnRDdXN0b21QbHVnaW5zOiBib29sZWFuXG59XG5cbmV4cG9ydCBjb25zdCBzZXR1cFBsYXlncm91bmQgPSAoXG4gIHNhbmRib3g6IFNhbmRib3gsXG4gIG1vbmFjbzogTW9uYWNvLFxuICBjb25maWc6IFBsYXlncm91bmRDb25maWcsXG4gIGk6IChrZXk6IHN0cmluZykgPT4gc3RyaW5nLFxuICByZWFjdDogdHlwZW9mIFJlYWN0XG4pID0+IHtcbiAgY29uc3QgcGxheWdyb3VuZFBhcmVudCA9IHNhbmRib3guZ2V0RG9tTm9kZSgpLnBhcmVudEVsZW1lbnQhLnBhcmVudEVsZW1lbnQhLnBhcmVudEVsZW1lbnQhXG4gIGNvbnN0IGRyYWdCYXIgPSBjcmVhdGVEcmFnQmFyKClcbiAgcGxheWdyb3VuZFBhcmVudC5hcHBlbmRDaGlsZChkcmFnQmFyKVxuXG4gIGNvbnN0IHNpZGViYXIgPSBjcmVhdGVTaWRlYmFyKClcbiAgcGxheWdyb3VuZFBhcmVudC5hcHBlbmRDaGlsZChzaWRlYmFyKVxuXG4gIGNvbnN0IHRhYkJhciA9IGNyZWF0ZVRhYkJhcigpXG4gIHNpZGViYXIuYXBwZW5kQ2hpbGQodGFiQmFyKVxuXG4gIGNvbnN0IGNvbnRhaW5lciA9IGNyZWF0ZVBsdWdpbkNvbnRhaW5lcigpXG4gIHNpZGViYXIuYXBwZW5kQ2hpbGQoY29udGFpbmVyKVxuXG4gIGNvbnN0IHBsdWdpbnMgPSBbXSBhcyBQbGF5Z3JvdW5kUGx1Z2luW11cbiAgY29uc3QgdGFicyA9IFtdIGFzIEhUTUxCdXR0b25FbGVtZW50W11cblxuICAvLyBMZXQncyB0aGluZ3MgbGlrZSB0aGUgd29ya2JlbmNoIGhvb2sgaW50byB0YWIgY2hhbmdlc1xuICBsZXQgZGlkVXBkYXRlVGFiOiAobmV3UGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luLCBwcmV2aW91c1BsdWdpbjogUGxheWdyb3VuZFBsdWdpbikgPT4gdm9pZCB8IHVuZGVmaW5lZFxuXG4gIGNvbnN0IHJlZ2lzdGVyUGx1Z2luID0gKHBsdWdpbjogUGxheWdyb3VuZFBsdWdpbikgPT4ge1xuICAgIHBsdWdpbnMucHVzaChwbHVnaW4pXG5cbiAgICBjb25zdCB0YWIgPSBjcmVhdGVUYWJGb3JQbHVnaW4ocGx1Z2luKVxuXG4gICAgdGFicy5wdXNoKHRhYilcblxuICAgIGNvbnN0IHRhYkNsaWNrZWQ6IEhUTUxFbGVtZW50W1wib25jbGlja1wiXSA9IGUgPT4ge1xuICAgICAgY29uc3QgcHJldmlvdXNQbHVnaW4gPSBnZXRDdXJyZW50UGx1Z2luKClcbiAgICAgIGxldCBuZXdUYWIgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudFxuICAgICAgLy8gSXQgY291bGQgYmUgYSBub3RpZmljYXRpb24geW91IGNsaWNrZWQgb25cbiAgICAgIGlmIChuZXdUYWIudGFnTmFtZSA9PT0gXCJESVZcIikgbmV3VGFiID0gbmV3VGFiLnBhcmVudEVsZW1lbnQhXG4gICAgICBjb25zdCBuZXdQbHVnaW4gPSBwbHVnaW5zLmZpbmQocCA9PiBgcGxheWdyb3VuZC1wbHVnaW4tdGFiLSR7cC5pZH1gID09IG5ld1RhYi5pZCkhXG4gICAgICBhY3RpdmF0ZVBsdWdpbihuZXdQbHVnaW4sIHByZXZpb3VzUGx1Z2luLCBzYW5kYm94LCB0YWJCYXIsIGNvbnRhaW5lcilcbiAgICAgIGRpZFVwZGF0ZVRhYiAmJiBkaWRVcGRhdGVUYWIobmV3UGx1Z2luLCBwcmV2aW91c1BsdWdpbilcbiAgICB9XG5cbiAgICB0YWJCYXIuYXBwZW5kQ2hpbGQodGFiKVxuICAgIHRhYi5vbmNsaWNrID0gdGFiQ2xpY2tlZFxuICB9XG5cbiAgY29uc3Qgc2V0RGlkVXBkYXRlVGFiID0gKGZ1bmM6IChuZXdQbHVnaW46IFBsYXlncm91bmRQbHVnaW4sIHByZXZpb3VzUGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luKSA9PiB2b2lkKSA9PiB7XG4gICAgZGlkVXBkYXRlVGFiID0gZnVuY1xuICB9XG5cbiAgY29uc3QgZ2V0Q3VycmVudFBsdWdpbiA9ICgpID0+IHtcbiAgICBjb25zdCBzZWxlY3RlZFRhYiA9IHRhYnMuZmluZCh0ID0+IHQuY2xhc3NMaXN0LmNvbnRhaW5zKFwiYWN0aXZlXCIpKSFcbiAgICByZXR1cm4gcGx1Z2luc1t0YWJzLmluZGV4T2Yoc2VsZWN0ZWRUYWIpXVxuICB9XG5cbiAgY29uc3QgZGVmYXVsdFBsdWdpbnMgPSBjb25maWcucGx1Z2lucyB8fCBnZXRQbGF5Z3JvdW5kUGx1Z2lucygpXG4gIGNvbnN0IHV0aWxzID0gY3JlYXRlVXRpbHMoc2FuZGJveCwgcmVhY3QpXG4gIGNvbnN0IGluaXRpYWxQbHVnaW5zID0gZGVmYXVsdFBsdWdpbnMubWFwKGYgPT4gZihpLCB1dGlscykpXG4gIGluaXRpYWxQbHVnaW5zLmZvckVhY2gocCA9PiByZWdpc3RlclBsdWdpbihwKSlcblxuICAvLyBDaG9vc2Ugd2hpY2ggc2hvdWxkIGJlIHNlbGVjdGVkXG4gIGNvbnN0IHByaW9yaXR5UGx1Z2luID0gcGx1Z2lucy5maW5kKHBsdWdpbiA9PiBwbHVnaW4uc2hvdWxkQmVTZWxlY3RlZCAmJiBwbHVnaW4uc2hvdWxkQmVTZWxlY3RlZCgpKVxuICBjb25zdCBzZWxlY3RlZFBsdWdpbiA9IHByaW9yaXR5UGx1Z2luIHx8IHBsdWdpbnNbMF1cbiAgY29uc3Qgc2VsZWN0ZWRUYWIgPSB0YWJzW3BsdWdpbnMuaW5kZXhPZihzZWxlY3RlZFBsdWdpbildIVxuICBzZWxlY3RlZFRhYi5vbmNsaWNrISh7IHRhcmdldDogc2VsZWN0ZWRUYWIgfSBhcyBhbnkpXG5cbiAgbGV0IGRlYm91bmNpbmdUaW1lciA9IGZhbHNlXG4gIHNhbmRib3guZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KF9ldmVudCA9PiB7XG4gICAgY29uc3QgcGx1Z2luID0gZ2V0Q3VycmVudFBsdWdpbigpXG4gICAgaWYgKHBsdWdpbi5tb2RlbENoYW5nZWQpIHBsdWdpbi5tb2RlbENoYW5nZWQoc2FuZGJveCwgc2FuZGJveC5nZXRNb2RlbCgpLCBjb250YWluZXIpXG5cbiAgICAvLyBUaGlzIG5lZWRzIHRvIGJlIGxhc3QgaW4gdGhlIGZ1bmN0aW9uXG4gICAgaWYgKGRlYm91bmNpbmdUaW1lcikgcmV0dXJuXG4gICAgZGVib3VuY2luZ1RpbWVyID0gdHJ1ZVxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZGVib3VuY2luZ1RpbWVyID0gZmFsc2VcbiAgICAgIHBsYXlncm91bmREZWJvdW5jZWRNYWluRnVuY3Rpb24oKVxuXG4gICAgICAvLyBPbmx5IGNhbGwgdGhlIHBsdWdpbiBmdW5jdGlvbiBvbmNlIGV2ZXJ5IDAuM3NcbiAgICAgIGlmIChwbHVnaW4ubW9kZWxDaGFuZ2VkRGVib3VuY2UgJiYgcGx1Z2luLmlkID09PSBnZXRDdXJyZW50UGx1Z2luKCkuaWQpIHtcbiAgICAgICAgcGx1Z2luLm1vZGVsQ2hhbmdlZERlYm91bmNlKHNhbmRib3gsIHNhbmRib3guZ2V0TW9kZWwoKSwgY29udGFpbmVyKVxuICAgICAgfVxuICAgIH0sIDMwMClcbiAgfSlcblxuICAvLyBJZiB5b3Ugc2V0IHRoaXMgdG8gdHJ1ZSwgdGhlbiB0aGUgbmV4dCB0aW1lIHRoZSBwbGF5Z3JvdW5kIHdvdWxkXG4gIC8vIGhhdmUgc2V0IHRoZSB1c2VyJ3MgaGFzaCBpdCB3b3VsZCBiZSBza2lwcGVkIC0gdXNlZCBmb3Igc2V0dGluZ1xuICAvLyB0aGUgdGV4dCBpbiBleGFtcGxlc1xuICBsZXQgc3VwcHJlc3NOZXh0VGV4dENoYW5nZUZvckhhc2hDaGFuZ2UgPSBmYWxzZVxuXG4gIC8vIFNldHMgdGhlIFVSTCBhbmQgc3RvcmFnZSBvZiB0aGUgc2FuZGJveCBzdHJpbmdcbiAgY29uc3QgcGxheWdyb3VuZERlYm91bmNlZE1haW5GdW5jdGlvbiA9ICgpID0+IHtcbiAgICBjb25zdCBhbHdheXNVcGRhdGVVUkwgPSAhbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJkaXNhYmxlLXNhdmUtb24tdHlwZVwiKVxuICAgIGlmIChhbHdheXNVcGRhdGVVUkwpIHtcbiAgICAgIGlmIChzdXBwcmVzc05leHRUZXh0Q2hhbmdlRm9ySGFzaENoYW5nZSkge1xuICAgICAgICBzdXBwcmVzc05leHRUZXh0Q2hhbmdlRm9ySGFzaENoYW5nZSA9IGZhbHNlXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgY29uc3QgbmV3VVJMID0gc2FuZGJveC5jcmVhdGVVUkxRdWVyeVdpdGhDb21waWxlck9wdGlvbnMoc2FuZGJveClcbiAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7fSwgXCJcIiwgbmV3VVJMKVxuICAgIH1cblxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic2FuZGJveC1oaXN0b3J5XCIsIHNhbmRib3guZ2V0VGV4dCgpKVxuICB9XG5cbiAgLy8gV2hlbiBhbnkgY29tcGlsZXIgZmxhZ3MgYXJlIGNoYW5nZWQsIHRyaWdnZXIgYSBwb3RlbnRpYWwgY2hhbmdlIHRvIHRoZSBVUkxcbiAgc2FuZGJveC5zZXREaWRVcGRhdGVDb21waWxlclNldHRpbmdzKCgpID0+IHtcbiAgICBwbGF5Z3JvdW5kRGVib3VuY2VkTWFpbkZ1bmN0aW9uKClcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgd2luZG93LmFwcEluc2lnaHRzICYmIHdpbmRvdy5hcHBJbnNpZ2h0cy50cmFja0V2ZW50KHsgbmFtZTogXCJDb21waWxlciBTZXR0aW5ncyBjaGFuZ2VkXCIgfSlcblxuICAgIGNvbnN0IG1vZGVsID0gc2FuZGJveC5lZGl0b3IuZ2V0TW9kZWwoKVxuICAgIGNvbnN0IHBsdWdpbiA9IGdldEN1cnJlbnRQbHVnaW4oKVxuICAgIGlmIChtb2RlbCAmJiBwbHVnaW4ubW9kZWxDaGFuZ2VkKSBwbHVnaW4ubW9kZWxDaGFuZ2VkKHNhbmRib3gsIG1vZGVsLCBjb250YWluZXIpXG4gICAgaWYgKG1vZGVsICYmIHBsdWdpbi5tb2RlbENoYW5nZWREZWJvdW5jZSkgcGx1Z2luLm1vZGVsQ2hhbmdlZERlYm91bmNlKHNhbmRib3gsIG1vZGVsLCBjb250YWluZXIpXG4gIH0pXG5cbiAgY29uc3Qgc2tpcEluaXRpYWxseVNldHRpbmdIYXNoID0gZG9jdW1lbnQubG9jYXRpb24uaGFzaCAmJiBkb2N1bWVudC5sb2NhdGlvbi5oYXNoLmluY2x1ZGVzKFwiZXhhbXBsZS9cIilcbiAgaWYgKCFza2lwSW5pdGlhbGx5U2V0dGluZ0hhc2gpIHBsYXlncm91bmREZWJvdW5jZWRNYWluRnVuY3Rpb24oKVxuXG4gIC8vIFNldHVwIHdvcmtpbmcgd2l0aCB0aGUgZXhpc3RpbmcgVUksIG9uY2UgaXQncyBsb2FkZWRcblxuICAvLyBWZXJzaW9ucyBvZiBUeXBlU2NyaXB0XG5cbiAgLy8gU2V0IHVwIHRoZSBsYWJlbCBmb3IgdGhlIGRyb3Bkb3duXG4gIGNvbnN0IHZlcnNpb25CdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiI3ZlcnNpb25zID4gYVwiKS5pdGVtKDApXG4gIHZlcnNpb25CdXR0b24uaW5uZXJIVE1MID0gXCJ2XCIgKyBzYW5kYm94LnRzLnZlcnNpb24gKyBcIiA8c3BhbiBjbGFzcz0nY2FyZXQnLz5cIlxuICB2ZXJzaW9uQnV0dG9uLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgYFNlbGVjdCB2ZXJzaW9uIG9mIFR5cGVTY3JpcHQsIGN1cnJlbnRseSAke3NhbmRib3gudHMudmVyc2lvbn1gKVxuXG4gIC8vIEFkZCB0aGUgdmVyc2lvbnMgdG8gdGhlIGRyb3Bkb3duXG4gIGNvbnN0IHZlcnNpb25zTWVudSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIjdmVyc2lvbnMgPiB1bFwiKS5pdGVtKDApXG5cbiAgLy8gRW5hYmxlIGFsbCBzdWJtZW51c1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwibmF2IHVsIGxpXCIpLmZvckVhY2goZSA9PiBlLmNsYXNzTGlzdC5hZGQoXCJhY3RpdmVcIikpXG5cbiAgY29uc3Qgbm90V29ya2luZ0luUGxheWdyb3VuZCA9IFtcIjMuMS42XCIsIFwiMy4wLjFcIiwgXCIyLjguMVwiLCBcIjIuNy4yXCIsIFwiMi40LjFcIl1cblxuICBjb25zdCBhbGxWZXJzaW9ucyA9IFsuLi5zYW5kYm94LnN1cHBvcnRlZFZlcnNpb25zLmZpbHRlcihmID0+ICFub3RXb3JraW5nSW5QbGF5Z3JvdW5kLmluY2x1ZGVzKGYpKSwgXCJOaWdodGx5XCJdXG5cbiAgYWxsVmVyc2lvbnMuZm9yRWFjaCgodjogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIilcbiAgICBjb25zdCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIilcbiAgICBhLnRleHRDb250ZW50ID0gdlxuICAgIGEuaHJlZiA9IFwiI1wiXG5cbiAgICBpZiAodiA9PT0gXCJOaWdodGx5XCIpIHtcbiAgICAgIGxpLmNsYXNzTGlzdC5hZGQoXCJuaWdodGx5XCIpXG4gICAgfVxuXG4gICAgaWYgKHYudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhcImJldGFcIikpIHtcbiAgICAgIGxpLmNsYXNzTGlzdC5hZGQoXCJiZXRhXCIpXG4gICAgfVxuXG4gICAgbGkub25jbGljayA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRVUkwgPSBzYW5kYm94LmNyZWF0ZVVSTFF1ZXJ5V2l0aENvbXBpbGVyT3B0aW9ucyhzYW5kYm94KVxuICAgICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhjdXJyZW50VVJMLnNwbGl0KFwiI1wiKVswXSlcbiAgICAgIGNvbnN0IHZlcnNpb24gPSB2ID09PSBcIk5pZ2h0bHlcIiA/IFwibmV4dFwiIDogdlxuICAgICAgcGFyYW1zLnNldChcInRzXCIsIHZlcnNpb24pXG5cbiAgICAgIGNvbnN0IGhhc2ggPSBkb2N1bWVudC5sb2NhdGlvbi5oYXNoLmxlbmd0aCA/IGRvY3VtZW50LmxvY2F0aW9uLmhhc2ggOiBcIlwiXG4gICAgICBjb25zdCBuZXdVUkwgPSBgJHtkb2N1bWVudC5sb2NhdGlvbi5wcm90b2NvbH0vLyR7ZG9jdW1lbnQubG9jYXRpb24uaG9zdH0ke2RvY3VtZW50LmxvY2F0aW9uLnBhdGhuYW1lfT8ke3BhcmFtc30ke2hhc2h9YFxuXG4gICAgICAvLyBAdHMtaWdub3JlIC0gaXQgaXMgYWxsb3dlZFxuICAgICAgZG9jdW1lbnQubG9jYXRpb24gPSBuZXdVUkxcbiAgICB9XG5cbiAgICBsaS5hcHBlbmRDaGlsZChhKVxuICAgIHZlcnNpb25zTWVudS5hcHBlbmRDaGlsZChsaSlcbiAgfSlcblxuICAvLyBTdXBwb3J0IGRyb3Bkb3duc1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLm5hdmJhci1zdWIgbGkuZHJvcGRvd24gPiBhXCIpLmZvckVhY2gobGluayA9PiB7XG4gICAgY29uc3QgYSA9IGxpbmsgYXMgSFRNTEFuY2hvckVsZW1lbnRcbiAgICBhLm9uY2xpY2sgPSBfZSA9PiB7XG4gICAgICBpZiAoYS5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QuY29udGFpbnMoXCJvcGVuXCIpKSB7XG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIubmF2YmFyLXN1YiBsaS5vcGVuXCIpLmZvckVhY2goaSA9PiBpLmNsYXNzTGlzdC5yZW1vdmUoXCJvcGVuXCIpKVxuICAgICAgICBhLnNldEF0dHJpYnV0ZShcImFyaWEtZXhwYW5kZWRcIiwgXCJmYWxzZVwiKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5uYXZiYXItc3ViIGxpLm9wZW5cIikuZm9yRWFjaChpID0+IGkuY2xhc3NMaXN0LnJlbW92ZShcIm9wZW5cIikpXG4gICAgICAgIGEucGFyZW50RWxlbWVudCEuY2xhc3NMaXN0LnRvZ2dsZShcIm9wZW5cIilcbiAgICAgICAgYS5zZXRBdHRyaWJ1dGUoXCJhcmlhLWV4cGFuZGVkXCIsIFwidHJ1ZVwiKVxuXG4gICAgICAgIGNvbnN0IGV4YW1wbGVDb250YWluZXIgPSBhLmNsb3Nlc3QoXCJsaVwiKSEuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJ1bFwiKS5pdGVtKDApIVxuXG4gICAgICAgIGNvbnN0IGZpcnN0TGFiZWwgPSBleGFtcGxlQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoXCJsYWJlbFwiKSBhcyBIVE1MRWxlbWVudFxuICAgICAgICBpZiAoZmlyc3RMYWJlbCkgZmlyc3RMYWJlbC5mb2N1cygpXG5cbiAgICAgICAgLy8gU2V0IGV4YWN0IGhlaWdodCBhbmQgd2lkdGhzIGZvciB0aGUgcG9wb3ZlcnMgZm9yIHRoZSBtYWluIHBsYXlncm91bmQgbmF2aWdhdGlvblxuICAgICAgICBjb25zdCBpc1BsYXlncm91bmRTdWJtZW51ID0gISFhLmNsb3Nlc3QoXCJuYXZcIilcbiAgICAgICAgaWYgKGlzUGxheWdyb3VuZFN1Ym1lbnUpIHtcbiAgICAgICAgICBjb25zdCBwbGF5Z3JvdW5kQ29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwbGF5Z3JvdW5kLWNvbnRhaW5lclwiKSFcbiAgICAgICAgICBleGFtcGxlQ29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGBjYWxjKCR7cGxheWdyb3VuZENvbnRhaW5lci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgKyAyNn1weCAtIDRyZW0pYFxuXG4gICAgICAgICAgY29uc3Qgc2lkZUJhcldpZHRoID0gKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1zaWRlYmFyXCIpIGFzIGFueSkub2Zmc2V0V2lkdGhcbiAgICAgICAgICBleGFtcGxlQ29udGFpbmVyLnN0eWxlLndpZHRoID0gYGNhbGMoMTAwJSAtICR7c2lkZUJhcldpZHRofXB4IC0gNzFweClgXG5cbiAgICAgICAgICAvLyBBbGwgdGhpcyBpcyB0byBtYWtlIHN1cmUgdGhhdCB0YWJiaW5nIHN0YXlzIGluc2lkZSB0aGUgZHJvcGRvd24gZm9yIHRzY29uZmlnL2V4YW1wbGVzXG4gICAgICAgICAgY29uc3QgYnV0dG9ucyA9IGV4YW1wbGVDb250YWluZXIucXVlcnlTZWxlY3RvckFsbChcImlucHV0XCIpXG4gICAgICAgICAgY29uc3QgbGFzdEJ1dHRvbiA9IGJ1dHRvbnMuaXRlbShidXR0b25zLmxlbmd0aCAtIDEpIGFzIEhUTUxFbGVtZW50XG4gICAgICAgICAgaWYgKGxhc3RCdXR0b24pIHtcbiAgICAgICAgICAgIHJlZGlyZWN0VGFiUHJlc3NUbyhsYXN0QnV0dG9uLCBleGFtcGxlQ29udGFpbmVyLCBcIi5leGFtcGxlcy1jbG9zZVwiKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzZWN0aW9ucyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJ1bC5leGFtcGxlcy1kcm9wZG93biAuc2VjdGlvbi1jb250ZW50XCIpXG4gICAgICAgICAgICBzZWN0aW9ucy5mb3JFYWNoKHMgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBidXR0b25zID0gcy5xdWVyeVNlbGVjdG9yQWxsKFwiYS5leGFtcGxlLWxpbmtcIilcbiAgICAgICAgICAgICAgY29uc3QgbGFzdEJ1dHRvbiA9IGJ1dHRvbnMuaXRlbShidXR0b25zLmxlbmd0aCAtIDEpIGFzIEhUTUxFbGVtZW50XG4gICAgICAgICAgICAgIGlmIChsYXN0QnV0dG9uKSB7XG4gICAgICAgICAgICAgICAgcmVkaXJlY3RUYWJQcmVzc1RvKGxhc3RCdXR0b24sIGV4YW1wbGVDb250YWluZXIsIFwiLmV4YW1wbGVzLWNsb3NlXCIpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH0pXG5cbiAgLy8gSGFuZGxlIGVzY2FwZSBjbG9zaW5nIGRyb3Bkb3ducyBldGNcbiAgZG9jdW1lbnQub25rZXlkb3duID0gZnVuY3Rpb24gKGV2dCkge1xuICAgIGV2dCA9IGV2dCB8fCB3aW5kb3cuZXZlbnRcbiAgICB2YXIgaXNFc2NhcGUgPSBmYWxzZVxuICAgIGlmIChcImtleVwiIGluIGV2dCkge1xuICAgICAgaXNFc2NhcGUgPSBldnQua2V5ID09PSBcIkVzY2FwZVwiIHx8IGV2dC5rZXkgPT09IFwiRXNjXCJcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQHRzLWlnbm9yZSAtIHRoaXMgdXNlZCB0byBiZSB0aGUgY2FzZVxuICAgICAgaXNFc2NhcGUgPSBldnQua2V5Q29kZSA9PT0gMjdcbiAgICB9XG4gICAgaWYgKGlzRXNjYXBlKSB7XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLm5hdmJhci1zdWIgbGkub3BlblwiKS5mb3JFYWNoKGkgPT4gaS5jbGFzc0xpc3QucmVtb3ZlKFwib3BlblwiKSlcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIubmF2YmFyLXN1YiBsaVwiKS5mb3JFYWNoKGkgPT4gaS5zZXRBdHRyaWJ1dGUoXCJhcmlhLWV4cGFuZGVkXCIsIFwiZmFsc2VcIikpXG4gICAgfVxuICB9XG5cbiAgY29uc3Qgc2hhcmVBY3Rpb24gPSB7XG4gICAgaWQ6IFwiY29weS1jbGlwYm9hcmRcIixcbiAgICBsYWJlbDogXCJTYXZlIHRvIGNsaXBib2FyZFwiLFxuICAgIGtleWJpbmRpbmdzOiBbbW9uYWNvLktleU1vZC5DdHJsQ21kIHwgbW9uYWNvLktleUNvZGUuS0VZX1NdLFxuXG4gICAgY29udGV4dE1lbnVHcm91cElkOiBcInJ1blwiLFxuICAgIGNvbnRleHRNZW51T3JkZXI6IDEuNSxcblxuICAgIHJ1bjogZnVuY3Rpb24gKCkge1xuICAgICAgd2luZG93Lm5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGxvY2F0aW9uLmhyZWYudG9TdHJpbmcoKSkudGhlbihcbiAgICAgICAgKCkgPT4gdWkuZmxhc2hJbmZvKGkoXCJwbGF5X2V4cG9ydF9jbGlwYm9hcmRcIikpLFxuICAgICAgICAoZTogYW55KSA9PiBhbGVydChlKVxuICAgICAgKVxuICAgIH0sXG4gIH1cblxuICBjb25zdCBzaGFyZUJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2hhcmUtYnV0dG9uXCIpXG4gIGlmIChzaGFyZUJ1dHRvbikge1xuICAgIHNoYXJlQnV0dG9uLm9uY2xpY2sgPSBlID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgc2hhcmVBY3Rpb24ucnVuKClcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIC8vIFNldCB1cCBzb21lIGtleSBjb21tYW5kc1xuICAgIHNhbmRib3guZWRpdG9yLmFkZEFjdGlvbihzaGFyZUFjdGlvbilcblxuICAgIHNhbmRib3guZWRpdG9yLmFkZEFjdGlvbih7XG4gICAgICBpZDogXCJydW4tanNcIixcbiAgICAgIGxhYmVsOiBcIlJ1biB0aGUgZXZhbHVhdGVkIEphdmFTY3JpcHQgZm9yIHlvdXIgVHlwZVNjcmlwdCBmaWxlXCIsXG4gICAgICBrZXliaW5kaW5nczogW21vbmFjby5LZXlNb2QuQ3RybENtZCB8IG1vbmFjby5LZXlDb2RlLkVudGVyXSxcblxuICAgICAgY29udGV4dE1lbnVHcm91cElkOiBcInJ1blwiLFxuICAgICAgY29udGV4dE1lbnVPcmRlcjogMS41LFxuXG4gICAgICBydW46IGZ1bmN0aW9uIChlZCkge1xuICAgICAgICBjb25zdCBydW5CdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInJ1bi1idXR0b25cIilcbiAgICAgICAgcnVuQnV0dG9uICYmIHJ1bkJ1dHRvbi5vbmNsaWNrICYmIHJ1bkJ1dHRvbi5vbmNsaWNrKHt9IGFzIGFueSlcbiAgICAgIH0sXG4gICAgfSlcbiAgfVxuXG4gIGNvbnN0IHJ1bkJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicnVuLWJ1dHRvblwiKVxuICBpZiAocnVuQnV0dG9uKSB7XG4gICAgcnVuQnV0dG9uLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICBjb25zdCBydW4gPSBzYW5kYm94LmdldFJ1bm5hYmxlSlMoKVxuICAgICAgY29uc3QgcnVuUGx1Z2luID0gcGx1Z2lucy5maW5kKHAgPT4gcC5pZCA9PT0gXCJsb2dzXCIpIVxuICAgICAgYWN0aXZhdGVQbHVnaW4ocnVuUGx1Z2luLCBnZXRDdXJyZW50UGx1Z2luKCksIHNhbmRib3gsIHRhYkJhciwgY29udGFpbmVyKVxuXG4gICAgICBydW5XaXRoQ3VzdG9tTG9ncyhydW4sIGkpXG5cbiAgICAgIGNvbnN0IGlzSlMgPSBzYW5kYm94LmNvbmZpZy51c2VKYXZhU2NyaXB0XG4gICAgICB1aS5mbGFzaEluZm8oaShpc0pTID8gXCJwbGF5X3J1bl9qc1wiIDogXCJwbGF5X3J1bl90c1wiKSlcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIC8vIEhhbmRsZSB0aGUgY2xvc2UgYnV0dG9ucyBvbiB0aGUgZXhhbXBsZXNcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvbi5leGFtcGxlcy1jbG9zZVwiKS5mb3JFYWNoKGIgPT4ge1xuICAgIGNvbnN0IGJ1dHRvbiA9IGIgYXMgSFRNTEJ1dHRvbkVsZW1lbnRcbiAgICBidXR0b24ub25jbGljayA9IChlOiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IGJ1dHRvbiA9IGUudGFyZ2V0IGFzIEhUTUxCdXR0b25FbGVtZW50XG4gICAgICBjb25zdCBuYXZMSSA9IGJ1dHRvbi5jbG9zZXN0KFwibGlcIilcbiAgICAgIG5hdkxJPy5jbGFzc0xpc3QucmVtb3ZlKFwib3BlblwiKVxuICAgIH1cbiAgfSlcblxuICBzZXR1cFNpZGViYXJUb2dnbGUoKVxuXG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNvbmZpZy1jb250YWluZXJcIikpIHtcbiAgICBjcmVhdGVDb25maWdEcm9wZG93bihzYW5kYm94LCBtb25hY28pXG4gICAgdXBkYXRlQ29uZmlnRHJvcGRvd25Gb3JDb21waWxlck9wdGlvbnMoc2FuZGJveCwgbW9uYWNvKVxuICB9XG5cbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicGxheWdyb3VuZC1zZXR0aW5nc1wiKSkge1xuICAgIGNvbnN0IHNldHRpbmdzVG9nZ2xlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwbGF5Z3JvdW5kLXNldHRpbmdzXCIpIVxuXG4gICAgc2V0dGluZ3NUb2dnbGUub25jbGljayA9ICgpID0+IHtcbiAgICAgIGNvbnN0IG9wZW4gPSBzZXR0aW5nc1RvZ2dsZS5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QuY29udGFpbnMoXCJvcGVuXCIpXG4gICAgICBjb25zdCBzaWRlYmFyVGFicyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1wbHVnaW4tdGFidmlld1wiKSBhcyBIVE1MRGl2RWxlbWVudFxuICAgICAgY29uc3Qgc2lkZWJhckNvbnRlbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBsYXlncm91bmQtcGx1Z2luLWNvbnRhaW5lclwiKSBhcyBIVE1MRGl2RWxlbWVudFxuICAgICAgbGV0IHNldHRpbmdzQ29udGVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1zZXR0aW5ncy1jb250YWluZXJcIikgYXMgSFRNTERpdkVsZW1lbnRcblxuICAgICAgaWYgKCFzZXR0aW5nc0NvbnRlbnQpIHtcbiAgICAgICAgc2V0dGluZ3NDb250ZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuICAgICAgICBzZXR0aW5nc0NvbnRlbnQuY2xhc3NOYW1lID0gXCJwbGF5Z3JvdW5kLXNldHRpbmdzLWNvbnRhaW5lciBwbGF5Z3JvdW5kLXBsdWdpbi1jb250YWluZXJcIlxuICAgICAgICBjb25zdCBzZXR0aW5ncyA9IHNldHRpbmdzUGx1Z2luKGksIHV0aWxzKVxuICAgICAgICBzZXR0aW5ncy5kaWRNb3VudCAmJiBzZXR0aW5ncy5kaWRNb3VudChzYW5kYm94LCBzZXR0aW5nc0NvbnRlbnQpXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1zaWRlYmFyXCIpIS5hcHBlbmRDaGlsZChzZXR0aW5nc0NvbnRlbnQpXG5cbiAgICAgICAgLy8gV2hlbiB0aGUgbGFzdCB0YWIgaXRlbSBpcyBoaXQsIGdvIGJhY2sgdG8gdGhlIHNldHRpbmdzIGJ1dHRvblxuICAgICAgICBjb25zdCBsYWJlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLnBsYXlncm91bmQtc2lkZWJhciBpbnB1dFwiKVxuICAgICAgICBjb25zdCBsYXN0TGFiZWwgPSBsYWJlbHMuaXRlbShsYWJlbHMubGVuZ3RoIC0gMSkgYXMgSFRNTEVsZW1lbnRcbiAgICAgICAgaWYgKGxhc3RMYWJlbCkge1xuICAgICAgICAgIHJlZGlyZWN0VGFiUHJlc3NUbyhsYXN0TGFiZWwsIHVuZGVmaW5lZCwgXCIjcGxheWdyb3VuZC1zZXR0aW5nc1wiKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChvcGVuKSB7XG4gICAgICAgIHNpZGViYXJUYWJzLnN0eWxlLmRpc3BsYXkgPSBcImZsZXhcIlxuICAgICAgICBzaWRlYmFyQ29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiXG4gICAgICAgIHNldHRpbmdzQ29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNpZGViYXJUYWJzLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuICAgICAgICBzaWRlYmFyQ29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcbiAgICAgICAgc2V0dGluZ3NDb250ZW50LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCJcbiAgICAgICAgOyhkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBsYXlncm91bmQtc2lkZWJhciBsYWJlbFwiKSBhcyBhbnkpLmZvY3VzKClcbiAgICAgIH1cbiAgICAgIHNldHRpbmdzVG9nZ2xlLnBhcmVudEVsZW1lbnQhLmNsYXNzTGlzdC50b2dnbGUoXCJvcGVuXCIpXG4gICAgfVxuXG4gICAgc2V0dGluZ3NUb2dnbGUuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgZSA9PiB7XG4gICAgICBjb25zdCBpc09wZW4gPSBzZXR0aW5nc1RvZ2dsZS5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QuY29udGFpbnMoXCJvcGVuXCIpXG4gICAgICBpZiAoZS5rZXlDb2RlID09PSA5ICYmIGlzT3Blbikge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBsYXlncm91bmQtb3B0aW9ucyBsaSBpbnB1dFwiKSBhcyBhbnlcbiAgICAgICAgcmVzdWx0LmZvY3VzKClcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIC8vIFN1cHBvcnQgZ3JhYmJpbmcgZXhhbXBsZXMgZnJvbSB0aGUgbG9jYXRpb24gaGFzaFxuICBpZiAobG9jYXRpb24uaGFzaC5zdGFydHNXaXRoKFwiI2V4YW1wbGVcIikpIHtcbiAgICBjb25zdCBleGFtcGxlTmFtZSA9IGxvY2F0aW9uLmhhc2gucmVwbGFjZShcIiNleGFtcGxlL1wiLCBcIlwiKS50cmltKClcbiAgICBzYW5kYm94LmNvbmZpZy5sb2dnZXIubG9nKFwiTG9hZGluZyBleGFtcGxlOlwiLCBleGFtcGxlTmFtZSlcbiAgICBnZXRFeGFtcGxlU291cmNlQ29kZShjb25maWcucHJlZml4LCBjb25maWcubGFuZywgZXhhbXBsZU5hbWUpLnRoZW4oZXggPT4ge1xuICAgICAgaWYgKGV4LmV4YW1wbGUgJiYgZXguY29kZSkge1xuICAgICAgICBjb25zdCB7IGV4YW1wbGUsIGNvZGUgfSA9IGV4XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBsb2NhbHN0b3JhZ2Ugc2hvd2luZyB0aGF0IHlvdSd2ZSBzZWVuIHRoaXMgcGFnZVxuICAgICAgICBpZiAobG9jYWxTdG9yYWdlKSB7XG4gICAgICAgICAgY29uc3Qgc2VlblRleHQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImV4YW1wbGVzLXNlZW5cIikgfHwgXCJ7fVwiXG4gICAgICAgICAgY29uc3Qgc2VlbiA9IEpTT04ucGFyc2Uoc2VlblRleHQpXG4gICAgICAgICAgc2VlbltleGFtcGxlLmlkXSA9IGV4YW1wbGUuaGFzaFxuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiZXhhbXBsZXMtc2VlblwiLCBKU09OLnN0cmluZ2lmeShzZWVuKSlcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFsbExpbmtzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcImV4YW1wbGUtbGlua1wiKVxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGZvciAoY29uc3QgbGluayBvZiBhbGxMaW5rcykge1xuICAgICAgICAgIGlmIChsaW5rLnRleHRDb250ZW50ID09PSBleGFtcGxlLnRpdGxlKSB7XG4gICAgICAgICAgICBsaW5rLmNsYXNzTGlzdC5hZGQoXCJoaWdobGlnaHRcIilcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBkb2N1bWVudC50aXRsZSA9IFwiVHlwZVNjcmlwdCBQbGF5Z3JvdW5kIC0gXCIgKyBleGFtcGxlLnRpdGxlXG4gICAgICAgIHN1cHByZXNzTmV4dFRleHRDaGFuZ2VGb3JIYXNoQ2hhbmdlID0gdHJ1ZVxuICAgICAgICBzYW5kYm94LnNldFRleHQoY29kZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN1cHByZXNzTmV4dFRleHRDaGFuZ2VGb3JIYXNoQ2hhbmdlID0gdHJ1ZVxuICAgICAgICBzYW5kYm94LnNldFRleHQoXCIvLyBUaGVyZSB3YXMgYW4gaXNzdWUgZ2V0dGluZyB0aGUgZXhhbXBsZSwgYmFkIFVSTD8gQ2hlY2sgdGhlIGNvbnNvbGUgaW4gdGhlIGRldmVsb3BlciB0b29sc1wiKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICAvLyBUaGlzIGlzbid0IG9wdGltYWwsIGJ1dCBpdCdzIGdvb2QgZW5vdWdoIHdpdGhvdXQgbWUgYWRkaW5nIHN1cHBvcnRcbiAgLy8gZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvbW9uYWNvLWVkaXRvci9pc3N1ZXMvMzEzXG4gIHNldEludGVydmFsKCgpID0+IHtcbiAgICBjb25zdCBtYXJrZXJzID0gc2FuZGJveC5tb25hY28uZWRpdG9yLmdldE1vZGVsTWFya2Vycyh7fSlcbiAgICB1dGlscy5zZXROb3RpZmljYXRpb25zKFwiZXJyb3JzXCIsIG1hcmtlcnMubGVuZ3RoKVxuICB9LCA1MDApXG5cbiAgLy8gU2V0cyB1cCBhIHdheSB0byBjbGljayBiZXR3ZWVuIGV4YW1wbGVzXG4gIG1vbmFjby5sYW5ndWFnZXMucmVnaXN0ZXJMaW5rUHJvdmlkZXIoc2FuZGJveC5sYW5ndWFnZSwgbmV3IEV4YW1wbGVIaWdobGlnaHRlcigpKVxuXG4gIGNvbnN0IGxhbmd1YWdlU2VsZWN0b3IgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxhbmd1YWdlLXNlbGVjdG9yXCIpIGFzIEhUTUxTZWxlY3RFbGVtZW50XG4gIGlmIChsYW5ndWFnZVNlbGVjdG9yKSB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhsb2NhdGlvbi5zZWFyY2gpXG4gICAgbGFuZ3VhZ2VTZWxlY3Rvci5vcHRpb25zLnNlbGVjdGVkSW5kZXggPSBwYXJhbXMuZ2V0KFwidXNlSmF2YVNjcmlwdFwiKSA/IDEgOiAwXG5cbiAgICBsYW5ndWFnZVNlbGVjdG9yLm9uY2hhbmdlID0gKCkgPT4ge1xuICAgICAgY29uc3QgdXNlSmF2YVNjcmlwdCA9IGxhbmd1YWdlU2VsZWN0b3IudmFsdWUgPT09IFwiSmF2YVNjcmlwdFwiXG4gICAgICBjb25zdCBxdWVyeSA9IHNhbmRib3guY3JlYXRlVVJMUXVlcnlXaXRoQ29tcGlsZXJPcHRpb25zKHNhbmRib3gsIHtcbiAgICAgICAgdXNlSmF2YVNjcmlwdDogdXNlSmF2YVNjcmlwdCA/IHRydWUgOiB1bmRlZmluZWQsXG4gICAgICB9KVxuICAgICAgY29uc3QgZnVsbFVSTCA9IGAke2RvY3VtZW50LmxvY2F0aW9uLnByb3RvY29sfS8vJHtkb2N1bWVudC5sb2NhdGlvbi5ob3N0fSR7ZG9jdW1lbnQubG9jYXRpb24ucGF0aG5hbWV9JHtxdWVyeX1gXG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBkb2N1bWVudC5sb2NhdGlvbiA9IGZ1bGxVUkxcbiAgICB9XG4gIH1cblxuICAvLyBFbnN1cmUgdGhhdCB0aGUgZWRpdG9yIGlzIGZ1bGwtd2lkdGggd2hlbiB0aGUgc2NyZWVuIHJlc2l6ZXNcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgKCkgPT4ge1xuICAgIHNhbmRib3guZWRpdG9yLmxheW91dCgpXG4gIH0pXG5cbiAgY29uc3QgdWkgPSBjcmVhdGVVSSgpXG4gIGNvbnN0IGV4cG9ydGVyID0gY3JlYXRlRXhwb3J0ZXIoc2FuZGJveCwgbW9uYWNvLCB1aSlcblxuICBjb25zdCBwbGF5Z3JvdW5kID0ge1xuICAgIGV4cG9ydGVyLFxuICAgIHVpLFxuICAgIHJlZ2lzdGVyUGx1Z2luLFxuICAgIHBsdWdpbnMsXG4gICAgZ2V0Q3VycmVudFBsdWdpbixcbiAgICB0YWJzLFxuICAgIHNldERpZFVwZGF0ZVRhYixcbiAgICBjcmVhdGVVdGlscyxcbiAgfVxuXG4gIHdpbmRvdy50cyA9IHNhbmRib3gudHNcbiAgd2luZG93LnNhbmRib3ggPSBzYW5kYm94XG4gIHdpbmRvdy5wbGF5Z3JvdW5kID0gcGxheWdyb3VuZFxuXG4gIGNvbnNvbGUubG9nKGBVc2luZyBUeXBlU2NyaXB0ICR7d2luZG93LnRzLnZlcnNpb259YClcblxuICBjb25zb2xlLmxvZyhcIkF2YWlsYWJsZSBnbG9iYWxzOlwiKVxuICBjb25zb2xlLmxvZyhcIlxcdHdpbmRvdy50c1wiLCB3aW5kb3cudHMpXG4gIGNvbnNvbGUubG9nKFwiXFx0d2luZG93LnNhbmRib3hcIiwgd2luZG93LnNhbmRib3gpXG4gIGNvbnNvbGUubG9nKFwiXFx0d2luZG93LnBsYXlncm91bmRcIiwgd2luZG93LnBsYXlncm91bmQpXG4gIGNvbnNvbGUubG9nKFwiXFx0d2luZG93LnJlYWN0XCIsIHdpbmRvdy5yZWFjdClcbiAgY29uc29sZS5sb2coXCJcXHR3aW5kb3cucmVhY3RET01cIiwgd2luZG93LnJlYWN0RE9NKVxuXG4gIC8qKiBBIHBsdWdpbiAqL1xuICBjb25zdCBhY3RpdmF0ZUV4dGVybmFsUGx1Z2luID0gKFxuICAgIHBsdWdpbjogUGxheWdyb3VuZFBsdWdpbiB8ICgodXRpbHM6IFBsdWdpblV0aWxzKSA9PiBQbGF5Z3JvdW5kUGx1Z2luKSxcbiAgICBhdXRvQWN0aXZhdGU6IGJvb2xlYW5cbiAgKSA9PiB7XG4gICAgbGV0IHJlYWR5UGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luXG4gICAgLy8gQ2FuIGVpdGhlciBiZSBhIGZhY3RvcnksIG9yIG9iamVjdFxuICAgIGlmICh0eXBlb2YgcGx1Z2luID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNvbnN0IHV0aWxzID0gY3JlYXRlVXRpbHMoc2FuZGJveCwgcmVhY3QpXG4gICAgICByZWFkeVBsdWdpbiA9IHBsdWdpbih1dGlscylcbiAgICB9IGVsc2Uge1xuICAgICAgcmVhZHlQbHVnaW4gPSBwbHVnaW5cbiAgICB9XG5cbiAgICBpZiAoYXV0b0FjdGl2YXRlKSB7XG4gICAgICBjb25zb2xlLmxvZyhyZWFkeVBsdWdpbilcbiAgICB9XG5cbiAgICBwbGF5Z3JvdW5kLnJlZ2lzdGVyUGx1Z2luKHJlYWR5UGx1Z2luKVxuXG4gICAgLy8gQXV0by1zZWxlY3QgdGhlIGRldiBwbHVnaW5cbiAgICBjb25zdCBwbHVnaW5XYW50c0Zyb250ID0gcmVhZHlQbHVnaW4uc2hvdWxkQmVTZWxlY3RlZCAmJiByZWFkeVBsdWdpbi5zaG91bGRCZVNlbGVjdGVkKClcblxuICAgIGlmIChwbHVnaW5XYW50c0Zyb250IHx8IGF1dG9BY3RpdmF0ZSkge1xuICAgICAgLy8gQXV0by1zZWxlY3QgdGhlIGRldiBwbHVnaW5cbiAgICAgIGFjdGl2YXRlUGx1Z2luKHJlYWR5UGx1Z2luLCBnZXRDdXJyZW50UGx1Z2luKCksIHNhbmRib3gsIHRhYkJhciwgY29udGFpbmVyKVxuICAgIH1cbiAgfVxuXG4gIC8vIERldiBtb2RlIHBsdWdpblxuICBpZiAoY29uZmlnLnN1cHBvcnRDdXN0b21QbHVnaW5zICYmIGFsbG93Q29ubmVjdGluZ1RvTG9jYWxob3N0KCkpIHtcbiAgICB3aW5kb3cuZXhwb3J0cyA9IHt9XG4gICAgY29uc29sZS5sb2coXCJDb25uZWN0aW5nIHRvIGRldiBwbHVnaW5cIilcbiAgICB0cnkge1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgY29uc3QgcmUgPSB3aW5kb3cucmVxdWlyZVxuICAgICAgcmUoW1wibG9jYWwvaW5kZXhcIl0sIChkZXZQbHVnaW46IGFueSkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcIlNldCB1cCBkZXYgcGx1Z2luIGZyb20gbG9jYWxob3N0OjUwMDBcIilcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhY3RpdmF0ZUV4dGVybmFsUGx1Z2luKGRldlBsdWdpbiwgdHJ1ZSlcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKVxuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdWkuZmxhc2hJbmZvKFwiRXJyb3I6IENvdWxkIG5vdCBsb2FkIGRldiBwbHVnaW4gZnJvbSBsb2NhbGhvc3Q6NTAwMFwiKVxuICAgICAgICAgIH0sIDcwMClcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIlByb2JsZW0gbG9hZGluZyB1cCB0aGUgZGV2IHBsdWdpblwiKVxuICAgICAgY29uc29sZS5lcnJvcihlcnJvcilcbiAgICB9XG4gIH1cblxuICBjb25zdCBkb3dubG9hZFBsdWdpbiA9IChwbHVnaW46IHN0cmluZywgYXV0b0VuYWJsZTogYm9vbGVhbikgPT4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBjb25zdCByZSA9IHdpbmRvdy5yZXF1aXJlXG4gICAgICByZShbYHVucGtnLyR7cGx1Z2lufUBsYXRlc3QvZGlzdC9pbmRleGBdLCAoZGV2UGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luKSA9PiB7XG4gICAgICAgIGFjdGl2YXRlRXh0ZXJuYWxQbHVnaW4oZGV2UGx1Z2luLCBhdXRvRW5hYmxlKVxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIlByb2JsZW0gbG9hZGluZyB1cCB0aGUgcGx1Z2luOlwiLCBwbHVnaW4pXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKVxuICAgIH1cbiAgfVxuXG4gIGlmIChjb25maWcuc3VwcG9ydEN1c3RvbVBsdWdpbnMpIHtcbiAgICAvLyBHcmFiIG9uZXMgZnJvbSBsb2NhbHN0b3JhZ2VcbiAgICBhY3RpdmVQbHVnaW5zKCkuZm9yRWFjaChwID0+IGRvd25sb2FkUGx1Z2luKHAuaWQsIGZhbHNlKSlcblxuICAgIC8vIE9mZmVyIHRvIGluc3RhbGwgb25lIGlmICdpbnN0YWxsLXBsdWdpbicgaXMgYSBxdWVyeSBwYXJhbVxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMobG9jYXRpb24uc2VhcmNoKVxuICAgIGNvbnN0IHBsdWdpblRvSW5zdGFsbCA9IHBhcmFtcy5nZXQoXCJpbnN0YWxsLXBsdWdpblwiKVxuICAgIGlmIChwbHVnaW5Ub0luc3RhbGwpIHtcbiAgICAgIGNvbnN0IGFscmVhZHlJbnN0YWxsZWQgPSBhY3RpdmVQbHVnaW5zKCkuZmluZChwID0+IHAuaWQgPT09IHBsdWdpblRvSW5zdGFsbClcbiAgICAgIGlmICghYWxyZWFkeUluc3RhbGxlZCkge1xuICAgICAgICBjb25zdCBzaG91bGREb0l0ID0gY29uZmlybShcIldvdWxkIHlvdSBsaWtlIHRvIGluc3RhbGwgdGhlIHRoaXJkIHBhcnR5IHBsdWdpbj9cXG5cXG5cIiArIHBsdWdpblRvSW5zdGFsbClcbiAgICAgICAgaWYgKHNob3VsZERvSXQpIHtcbiAgICAgICAgICBhZGRDdXN0b21QbHVnaW4ocGx1Z2luVG9JbnN0YWxsKVxuICAgICAgICAgIGRvd25sb2FkUGx1Z2luKHBsdWdpblRvSW5zdGFsbCwgdHJ1ZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChsb2NhdGlvbi5oYXNoLnN0YXJ0c1dpdGgoXCIjc2hvdy1leGFtcGxlc1wiKSkge1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJleGFtcGxlcy1idXR0b25cIik/LmNsaWNrKClcbiAgICB9LCAxMDApXG4gIH1cblxuICBpZiAobG9jYXRpb24uaGFzaC5zdGFydHNXaXRoKFwiI3Nob3ctd2hhdGlzbmV3XCIpKSB7XG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIndoYXRpc25ldy1idXR0b25cIik/LmNsaWNrKClcbiAgICB9LCAxMDApXG4gIH1cblxuICByZXR1cm4gcGxheWdyb3VuZFxufVxuXG5leHBvcnQgdHlwZSBQbGF5Z3JvdW5kID0gUmV0dXJuVHlwZTx0eXBlb2Ygc2V0dXBQbGF5Z3JvdW5kPlxuXG5jb25zdCByZWRpcmVjdFRhYlByZXNzVG8gPSAoZWxlbWVudDogSFRNTEVsZW1lbnQsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQsIHF1ZXJ5OiBzdHJpbmcpID0+IHtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBlID0+IHtcbiAgICBpZiAoZS5rZXlDb2RlID09PSA5KSB7XG4gICAgICBjb25zdCBob3N0ID0gY29udGFpbmVyIHx8IGRvY3VtZW50XG4gICAgICBjb25zdCByZXN1bHQgPSBob3N0LnF1ZXJ5U2VsZWN0b3IocXVlcnkpIGFzIGFueVxuICAgICAgaWYgKCFyZXN1bHQpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgdG8gZmluZCBhIHJlc3VsdCBmb3Iga2V5ZG93bmApXG4gICAgICByZXN1bHQuZm9jdXMoKVxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgfVxuICB9KVxufVxuIl19