import Vue, { VueConstructor } from "vue";
import { DxComponent, IWidgetComponent } from "../core/component";
import { DxConfiguration, IConfigurable, IConfigurationComponent } from "../core/configuration-component";
import { DxExtensionComponent } from "../core/extension-component";

import * as events from "devextreme/events";

const eventHandlers: { [index: string]: (e?: any) => void } = {};
const Widget = {
    option: jest.fn(),
    dispose: jest.fn(),
    on: (event: string, handler: (e: any) => void) => {
        eventHandlers[event] = handler;
    },
    fire: (event: string, args: any) => {
        if (!eventHandlers[event]) {
            throw new Error(`no handler registered for '${event}'`);
        }
        eventHandlers[event](args);
    },
    beginUpdate: jest.fn(),
    endUpdate: jest.fn(),
};

function createWidget(_, options) {
    if (options.onInitializing) {
        options.onInitializing.call(Widget);
    }
    return Widget;
}
const WidgetClass = jest.fn(createWidget);

const TestComponent = Vue.extend({
    extends: DxComponent,
    beforeCreate() {
        (this as any as IWidgetComponent).$_WidgetClass = WidgetClass;
    }
});

function skipIntegrationOptions(options: {
    integrationOptions: object,
    onInitializing: () => void
}): Record<string, any> {
    const result = {...options };
    delete result.integrationOptions;
    delete result.onInitializing;
    return result;
}

function buildTestConfigCtor(): VueConstructor {
    return Vue.extend({
        extends: DxConfiguration,
        props: {
            prop1: Number,
            prop2: String
        }
    });
}

jest.setTimeout(1000);
beforeEach(() => {
    jest.clearAllMocks();
});

describe("component rendering", () => {

    it("correctly renders", () => {
        const vm = new TestComponent().$mount();
        expect(vm.$el.outerHTML).toBe("<div></div>");
    });

    it("calls widget creation", () => {
        new TestComponent().$mount();
        expect(WidgetClass).toHaveBeenCalledTimes(1);
        expect(Widget.beginUpdate).toHaveBeenCalledTimes(1);
        expect(Widget.endUpdate).toHaveBeenCalledTimes(1);
    });

    it("component has disabled inheritAttrs", () => {
        const component = new TestComponent();
        expect(component.$options.inheritAttrs).toBe(false);
    });

    it("passes id to element", () => {
        const vm = new Vue({
            template: "<test-component id='my-id'/>",
            components: {
                TestComponent
            }
        }).$mount();

        expect(vm.$el.id).toBe("my-id");
    });

    it("creates nested component", () => {
        new Vue({
            template: "<test-component><test-component/></test-component>",
            components: {
                TestComponent
            }
        }).$mount();

        expect(WidgetClass.mock.instances.length).toBe(2);
        expect(WidgetClass.mock.instances[1]).toEqual({});
    });
});

describe("options", () => {

    it("pass props to option on mounting", () => {
        const vm = new TestComponent({
            propsData: {
                sampleProp: "default"
            }
        }).$mount();

        expect(WidgetClass.mock.calls[0][0]).toBe(vm.$el);

        expect(skipIntegrationOptions(WidgetClass.mock.calls[0][1])).toEqual({
            sampleProp: "default"
        });
    });

    it("subscribes to optionChanged", () => {
        new TestComponent({
            props: ["sampleProp"]
        }).$mount();

        expect(eventHandlers).toHaveProperty("optionChanged");
    });

    it("watch prop changing", (done) => {
        const vm = new TestComponent({
            props: ["sampleProp"],
            propsData: {
                sampleProp: "default"
            }
        }).$mount();

        vm.$props.sampleProp = "new";
        Vue.nextTick(() => {
            expect(Widget.option).toHaveBeenCalledTimes(1);
            expect(Widget.option).toHaveBeenCalledWith("sampleProp", "new");
            done();
        });
    });

    it("watch array prop changing", (done) => {
        const arrayValue = [{ text: "text" }];
        new TestComponent({
            props: ["sampleProp"],
            propsData: {
                sampleProp: arrayValue
            }
        }).$mount();
        const valueChangedCallback = jest.fn();
        WidgetClass.mock.calls[0][1].integrationOptions.watchMethod(() => {
            return arrayValue[0].text;
        }, valueChangedCallback);

        expect(valueChangedCallback).toHaveBeenCalledTimes(1);
        expect(valueChangedCallback.mock.calls[0][0]).toBe("text");

        arrayValue[0].text = "changedText";
        Vue.nextTick(() => {
            expect(valueChangedCallback).toHaveBeenCalledTimes(2);
            expect(valueChangedCallback.mock.calls[1][0]).toBe("changedText");
            done();
        });
    });

    it("watch array prop changing with Date", (done) => {
        const date = new Date(2018, 11, 11);
        const arrayValue = [{ date }];
        new TestComponent({
            props: ["sampleProp"],
            propsData: {
                sampleProp: arrayValue
            }
        }).$mount();
        const valueChangedCallback = jest.fn();
        WidgetClass.mock.calls[0][1].integrationOptions.watchMethod(() => {
            return arrayValue[0].date;
        }, valueChangedCallback);

        expect(valueChangedCallback).toHaveBeenCalledTimes(1);
        expect(valueChangedCallback.mock.calls[0][0]).toBe(date);

        arrayValue[0].date = new Date(2018, 11, 11);
        Vue.nextTick(() => {
            expect(valueChangedCallback).toHaveBeenCalledTimes(1);
            expect(valueChangedCallback.mock.calls[0][0]).toBe(date);

            arrayValue[0].date = new Date(2018, 11, 12);
            Vue.nextTick(() => {
                expect(valueChangedCallback).toHaveBeenCalledTimes(2);
                expect(valueChangedCallback.mock.calls[1][0]).toEqual(new Date(2018, 11, 12));
                done();
            });
        });
    });

    it("watch array prop changing (deep)", (done) => {
        const arrayValue = [{
            data: {
                text: "text"
            }
        }];
        new TestComponent({
            props: ["sampleProp"],
            propsData: {
                sampleProp: arrayValue
            }
        }).$mount();
        const valueChangedCallback = jest.fn();
        WidgetClass.mock.calls[0][1].integrationOptions.watchMethod(() => {
            return arrayValue[0].data;
        }, valueChangedCallback, {
            deep: true
        });
        expect(valueChangedCallback).toHaveBeenCalledTimes(1);
        expect(valueChangedCallback.mock.calls[0][0]).toEqual({ text: "text" });

        arrayValue[0].data.text = "changedText";

        Vue.nextTick(() => {
            expect(valueChangedCallback).toHaveBeenCalledTimes(2);
            expect(valueChangedCallback.mock.calls[0][0]).toEqual({ text: "changedText" });
            done();
        });
    });

    it("watch array prop changing (skipImmediate)", (done) => {
        const arrayValue = [{
            text: "text"
        }];
        new TestComponent({
            props: ["sampleProp"],
            propsData: {
                sampleProp: arrayValue
            }
        }).$mount();
        const valueChangedCallback = jest.fn();
        WidgetClass.mock.calls[0][1].integrationOptions.watchMethod(() => {
            return arrayValue[0].text;
        }, valueChangedCallback, {
            skipImmediate: true
        });
        expect(valueChangedCallback).toHaveBeenCalledTimes(0);

        arrayValue[0].text = "changedText";

        Vue.nextTick(() => {
            expect(valueChangedCallback).toHaveBeenCalledTimes(1);
            expect(valueChangedCallback.mock.calls[0][0]).toEqual("changedText");
            done();
        });
    });
});

describe("configuration", () => {

    const Nested = buildTestConfigCtor();
    (Nested as any as IConfigurationComponent).$_optionName = "nestedOption";

    it("creates configuration", () => {
        const vm = new TestComponent();

        expect((vm as IConfigurable).$_config).not.toBeNull();
    });

    it("passes configuration initialValues to widget ctor", () => {
        const initialValues = {
            a: {},
            b: {
                c: {
                    d: {}
                }
            }
        };

        const vm = new TestComponent();
        (vm as IConfigurable).$_config = {
            getInitialValues: jest.fn(() => initialValues),
            getOptionsToWatch: jest.fn()
        } as any;

        vm.$mount();

        expect(WidgetClass).toHaveBeenCalledTimes(1);
        expect(WidgetClass.mock.calls[0][1].a).toBe(initialValues.a);
        expect(WidgetClass.mock.calls[0][1].b).toBe(initialValues.b);
        expect(WidgetClass.mock.calls[0][1].b.c).toBe(initialValues.b.c);
        expect(WidgetClass.mock.calls[0][1].b.c.d).toBe(initialValues.b.c.d);
    });

    it("calls the option method from a widget component configuration updateFunc", () => {
        const optionSetter = jest.fn();
        const vm = new TestComponent();

        (vm as IWidgetComponent).$_instance = {
            option: optionSetter
        };
        const name = "abc";
        const value = {};

        (vm as IConfigurable).$_config.updateFunc(name, value);

        expect(optionSetter).toHaveBeenCalledTimes(1);
        expect(optionSetter.mock.calls[0][0]).toBe(name);
        expect(optionSetter.mock.calls[0][1]).toBe(value);
    });

    it("initializes nested config", () => {
        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested :prop1="123" />` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested
            }
        }).$mount();

        const config = (vm.$children[0] as any as IConfigurable).$_config;
        expect(config.nested).toHaveLength(1);
        expect(config.nested[0].name).toBe("nestedOption");
        expect(config.nested[0].options).toEqual(["prop1", "prop2"]);
        expect(config.nested[0].initialValues).toEqual({ prop1: 123 });
        expect(config.nested[0].isCollectionItem).toBeFalsy();
    });

    it("initializes nested config (collectionItem)", () => {
        const nestedCollectionItem = buildTestConfigCtor();
        (nestedCollectionItem as any as IConfigurationComponent).$_optionName = "nestedOption";
        (nestedCollectionItem as any as IConfigurationComponent).$_isCollectionItem = true;

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested-collection-item :prop1="123" />` +
                `</test-component>`,
            components: {
                TestComponent,
                nestedCollectionItem
            }
        }).$mount();

        const config = (vm.$children[0] as any as IConfigurable).$_config;
        expect(config.nested).toHaveLength(1);
        expect(config.nested[0].name).toBe("nestedOption");
        expect(config.nested[0].options).toEqual(["prop1", "prop2"]);
        expect(config.nested[0].initialValues).toEqual({ prop1: 123 });
        expect(config.nested[0].isCollectionItem).toBeTruthy();
        expect(config.nested[0].collectionItemIndex).toBe(0);
    });

    it("initializes nested config (several collectionItems)", () => {
        const nestedCollectionItem = buildTestConfigCtor();
        (nestedCollectionItem as any as IConfigurationComponent).$_optionName = "nestedOption";
        (nestedCollectionItem as any as IConfigurationComponent).$_isCollectionItem = true;

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested-collection-item :prop1="123" />` +
                `  <nested-collection-item :prop1="456" prop2="abc" />` +
                `  <nested-collection-item prop2="def" />` +
                `</test-component>`,
            components: {
                TestComponent,
                nestedCollectionItem
            }
        }).$mount();

        const config = (vm.$children[0] as any as IConfigurable).$_config;
        expect(config.nested).toHaveLength(3);

        expect(config.nested[0].name).toBe("nestedOption");
        expect(config.nested[0].options).toEqual(["prop1", "prop2"]);
        expect(config.nested[0].initialValues).toEqual({ prop1: 123 });
        expect(config.nested[0].isCollectionItem).toBeTruthy();
        expect(config.nested[0].collectionItemIndex).toBe(0);

        expect(config.nested[1].name).toBe("nestedOption");
        expect(config.nested[1].options).toEqual(["prop1", "prop2"]);
        expect(config.nested[1].initialValues).toEqual({ prop1: 456, prop2: "abc" });
        expect(config.nested[1].isCollectionItem).toBeTruthy();
        expect(config.nested[1].collectionItemIndex).toBe(1);

        expect(config.nested[2].name).toBe("nestedOption");
        expect(config.nested[2].options).toEqual(["prop1", "prop2"]);
        expect(config.nested[2].initialValues).toEqual({ prop2: "def" });
        expect(config.nested[2].isCollectionItem).toBeTruthy();
        expect(config.nested[2].collectionItemIndex).toBe(2);
    });

    it("initializes nested config predefined prop", () => {
        const predefinedValue = {};
        const NestedWithPredefined = buildTestConfigCtor();
        (NestedWithPredefined as any as IConfigurationComponent).$_optionName = "nestedOption";
        (NestedWithPredefined as any as IConfigurationComponent).$_predefinedProps = {
            predefinedProp: predefinedValue
        };

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested-with-predefined />` +
                `</test-component>`,
            components: {
                TestComponent,
                NestedWithPredefined
            }
        }).$mount();

        const config = (vm.$children[0] as any as IConfigurable).$_config;
        const initialValues = config.getInitialValues();
        expect(initialValues).toHaveProperty("nestedOption");
        expect(initialValues!.nestedOption).toHaveProperty("predefinedProp");
        expect(initialValues!.nestedOption!.predefinedProp).toBe(predefinedValue);
    });

    it("initializes sub-nested config", () => {
        const subNested = buildTestConfigCtor();
        (subNested as any as IConfigurationComponent).$_optionName = "subNestedOption";

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested :prop1="123">` +
                `    <sub-nested prop2="abc"/>` +
                `  </nested>` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested,
                subNested
            }
        }).$mount();

        const config = (vm.$children[0] as any as IConfigurable).$_config;
        expect(config.nested).toHaveLength(1);

        const nestedConfig = config.nested[0];
        expect(nestedConfig.nested).toHaveLength(1);

        expect(nestedConfig.nested[0].name).toBe("subNestedOption");
        expect(nestedConfig.nested[0].options).toEqual(["prop1", "prop2"]);
        expect(nestedConfig.nested[0].initialValues).toEqual({ prop2: "abc" });
        expect(nestedConfig.nested[0].isCollectionItem).toBeFalsy();
    });

    it("initializes sub-nested config (collectionItem)", () => {
        const nestedCollectionItem = buildTestConfigCtor();
        (nestedCollectionItem as any as IConfigurationComponent).$_optionName = "subNestedOption";
        (nestedCollectionItem as any as IConfigurationComponent).$_isCollectionItem = true;

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested>` +
                `    <nested-collection-item :prop1="123"/>` +
                `  </nested>` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested,
                nestedCollectionItem
            }
        }).$mount();

        const config = (vm.$children[0] as any as IConfigurable).$_config;
        expect(config.nested).toHaveLength(1);

        const nestedConfig = config.nested[0];
        expect(nestedConfig.nested).toHaveLength(1);

        expect(nestedConfig.nested[0].name).toBe("subNestedOption");
        expect(nestedConfig.nested[0].options).toEqual(["prop1", "prop2"]);
        expect(nestedConfig.nested[0].initialValues).toEqual({ prop1: 123 });
        expect(nestedConfig.nested[0].isCollectionItem).toBeTruthy();
        expect(nestedConfig.nested[0].collectionItemIndex).toBe(0);
    });

    it("initializes sub-nested config (multiple collectionItems)", () => {
        const nestedCollectionItem = buildTestConfigCtor();
        (nestedCollectionItem as any as IConfigurationComponent).$_optionName = "subNestedOption";
        (nestedCollectionItem as any as IConfigurationComponent).$_isCollectionItem = true;

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested>` +
                `    <nested-collection-item :prop1="123" />` +
                `    <nested-collection-item :prop1="456" prop2="abc" />` +
                `    <nested-collection-item prop2="def" />` +
                `  </nested>` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested,
                nestedCollectionItem
            }
        }).$mount();

        const config = (vm.$children[0] as any as IConfigurable).$_config;
        expect(config.nested).toHaveLength(1);

        const nestedConfig = config.nested[0];
        expect(nestedConfig.nested).toHaveLength(3);

        expect(nestedConfig.nested[0].name).toBe("subNestedOption");
        expect(nestedConfig.nested[0].options).toEqual(["prop1", "prop2"]);
        expect(nestedConfig.nested[0].initialValues).toEqual({ prop1: 123 });
        expect(nestedConfig.nested[0].isCollectionItem).toBeTruthy();
        expect(nestedConfig.nested[0].collectionItemIndex).toBe(0);

        expect(nestedConfig.nested[1].name).toBe("subNestedOption");
        expect(nestedConfig.nested[1].options).toEqual(["prop1", "prop2"]);
        expect(nestedConfig.nested[1].initialValues).toEqual({ prop1: 456, prop2: "abc" });
        expect(nestedConfig.nested[1].isCollectionItem).toBeTruthy();
        expect(nestedConfig.nested[1].collectionItemIndex).toBe(1);

        expect(nestedConfig.nested[2].name).toBe("subNestedOption");
        expect(nestedConfig.nested[2].options).toEqual(["prop1", "prop2"]);
        expect(nestedConfig.nested[2].initialValues).toEqual({ prop2: "def" });
        expect(nestedConfig.nested[2].isCollectionItem).toBeTruthy();
        expect(nestedConfig.nested[2].collectionItemIndex).toBe(2);
    });

    describe("expectedChildren", () => {

        it("initialized for widget component", () => {
            const expected = {};

            const WidgetComponent = Vue.extend({
                extends: DxComponent,
                beforeCreate() {
                    (this as any as IWidgetComponent).$_WidgetClass = WidgetClass;
                    (this as any as IWidgetComponent).$_expectedChildren = expected;
                }
            });

            const vm = new WidgetComponent();

            expect((vm as IWidgetComponent).$_config.expectedChildren).toBe(expected);
        });

        it("initialized for config component", () => {
            const expected = {};

            const ConfigComponent = buildTestConfigCtor();
            (ConfigComponent as any as IConfigurationComponent).$_optionName = "nestedOption";
            (ConfigComponent as any as IConfigurationComponent).$_expectedChildren = expected;

            const vm = new Vue({
                template:
                    `<test-component>` +
                    `  <config-component />` +
                    `</test-component>`,
                components: {
                    TestComponent,
                    ConfigComponent
                }
            }).$mount();

            const widgetConfig = (vm.$children[0] as any as IConfigurable).$_config;
            expect(widgetConfig.nested[0].expectedChildren).toBe(expected);
        });
    });

});

describe("nested option", () => {

    const Nested = buildTestConfigCtor();
    (Nested as any as IConfigurationComponent).$_optionName = "nestedOption";

    it("pulls initital values", () => {
        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested :prop1="123" />` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested
            }
        }).$mount();

        expect(WidgetClass.mock.calls[0][0]).toBe(vm.$children[0].$el);

        expect(skipIntegrationOptions(WidgetClass.mock.calls[0][1])).toEqual({
            nestedOption: {
                prop1: 123
            }
        });
    });

    it("pulls initital values (collectionItem)", () => {
        const nestedCollectionItem = buildTestConfigCtor();
        (nestedCollectionItem as any as IConfigurationComponent).$_optionName = "nestedOption";
        (nestedCollectionItem as any as IConfigurationComponent).$_isCollectionItem = true;

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested-collection-item :prop1="123" />` +
                `</test-component>`,
            components: {
                TestComponent,
                nestedCollectionItem
            }
        }).$mount();

        expect(WidgetClass.mock.calls[0][0]).toBe(vm.$children[0].$el);

        expect(skipIntegrationOptions(WidgetClass.mock.calls[0][1])).toEqual({
            nestedOption: [{
                prop1: 123
            }]
        });
    });

    it("pulls initital values (subnested)", () => {
        const subNested = buildTestConfigCtor();
        (subNested as any as IConfigurationComponent).$_optionName = "subNestedOption";

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested :prop1="123">` +
                `    <sub-nested prop2="abc"/>` +
                `  </nested>` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested,
                subNested
            }
        }).$mount();

        expect(WidgetClass.mock.calls[0][0]).toBe(vm.$children[0].$el);

        expect(skipIntegrationOptions(WidgetClass.mock.calls[0][1])).toEqual({
            nestedOption: {
                prop1: 123,
                subNestedOption: {
                    prop2: "abc"
                }
            }
        });
    });

    it("pulls initital values (subnested collectionItem)", () => {
        const nestedCollectionItem = buildTestConfigCtor();
        (nestedCollectionItem as any as IConfigurationComponent).$_optionName = "subNestedOption";
        (nestedCollectionItem as any as IConfigurationComponent).$_isCollectionItem = true;

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested :prop1="123">` +
                `    <nested-collection-item prop2="abc"/>` +
                `  </nested>` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested,
                nestedCollectionItem
            }
        }).$mount();

        expect(WidgetClass.mock.calls[0][0]).toBe(vm.$children[0].$el);

        expect(skipIntegrationOptions(WidgetClass.mock.calls[0][1])).toEqual({
            nestedOption: {
                prop1: 123,
                subNestedOption: [{
                    prop2: "abc"
                }]
            }
        });
    });

    it("watches option changes", (done) => {
        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested :prop1="value" />` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested
            },
            props: ["value"],
            propsData: {
                value: 123
            }
        }).$mount();

        vm.$props.value = 456;

        Vue.nextTick(() => {
            expect(Widget.option).toHaveBeenCalledTimes(1);
            expect(Widget.option).toHaveBeenCalledWith("nestedOption.prop1", 456);
            done();
        });
    });

    it("watches option changes (collectionItem)", (done) => {
        const nestedCollectionItem = buildTestConfigCtor();
        (nestedCollectionItem as any as IConfigurationComponent).$_optionName = "nestedOption";
        (nestedCollectionItem as any as IConfigurationComponent).$_isCollectionItem = true;

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested-collection-item :prop1="value" />` +
                `</test-component>`,
            components: {
                TestComponent,
                nestedCollectionItem
            },
            props: ["value"],
            propsData: {
                value: 123
            }
        }).$mount();

        vm.$props.value = 456;

        Vue.nextTick(() => {
            expect(Widget.option).toHaveBeenCalledTimes(1);
            expect(Widget.option).toHaveBeenCalledWith("nestedOption[0].prop1", 456);
            done();
        });
    });

    it("watches option changes (subnested)", (done) => {
        const subNested = buildTestConfigCtor();
        (subNested as any as IConfigurationComponent).$_optionName = "subNestedOption";

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested>` +
                `    <sub-nested :prop1="value"/>` +
                `  </nested>` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested,
                subNested
            },
            props: ["value"],
            propsData: {
                value: 123
            }
        }).$mount();

        vm.$props.value = 456;

        Vue.nextTick(() => {
            expect(Widget.option).toHaveBeenCalledTimes(1);
            expect(Widget.option).toHaveBeenCalledWith("nestedOption.subNestedOption.prop1", 456);
            done();
        });
    });

    it("watches option changes (subnested collectionItem)", (done) => {
        const subNestedCollectionItem = buildTestConfigCtor();
        (subNestedCollectionItem as any as IConfigurationComponent).$_optionName = "subNestedOption";
        (subNestedCollectionItem as any as IConfigurationComponent).$_isCollectionItem = true;

        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested>` +
                `    <sub-nested-collection-item :prop1="value"/>` +
                `  </nested>` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested,
                subNestedCollectionItem
            },
            props: ["value"],
            propsData: {
                value: 123
            }
        }).$mount();

        vm.$props.value = 456;

        Vue.nextTick(() => {
            expect(Widget.option).toHaveBeenCalledTimes(1);
            expect(Widget.option).toHaveBeenCalledWith("nestedOption.subNestedOption[0].prop1", 456);
            done();
        });
    });

    it.skip("is not duplicated on rerender", (cb) => {
        const vm = new Vue({
            template:
                `<test-component>` +
                `  <nested :prop1="123" />` +
                `</test-component>`,
            components: {
                TestComponent,
                Nested
            }
        }).$mount();
        const config = (vm.$children[0] as any as IConfigurable).$_config;

        vm.$forceUpdate();

        Vue.nextTick(() => {
            try {
                expect(config.nested).toHaveLength(1);
            } catch (e) {
                cb.fail(e);
            }
            cb();
        });
    });

});

function renderTemplate(name: string, model?: object, container?: any): Element {
    model = model || {};
    container = container || document.createElement("div");
    const render = WidgetClass.mock.calls[0][1].integrationOptions.templates[name].render;
    return render({
        container,
        model
    });
}

describe("template", () => {

    const DX_TEMPLATE_WRAPPER = "dx-template-wrapper";

    function renderItemTemplate(model?: object, container?: any): Element {
        return renderTemplate("item", model, container);
    }

    it("passes integrationOptions to widget", () => {
        new Vue({
            template: `<test-component>
                         <div slot='item' slot-scope='data'>1</div>
                         <div slot='content' slot-scope='_'>1</div>
                         <div>1</div>
                       </test-component>`,
            components: {
                TestComponent
            }
        }).$mount();
        const integrationOptions = WidgetClass.mock.calls[0][1].integrationOptions;

        expect(integrationOptions).toBeDefined();
        expect(integrationOptions.templates).toBeDefined();

        expect(integrationOptions.templates.item).toBeDefined();
        expect(typeof integrationOptions.templates.item.render).toBe("function");

        expect(integrationOptions.templates.content).toBeDefined();
        expect(typeof integrationOptions.templates.content.render).toBe("function");

        expect(integrationOptions.templates.default).toBeUndefined();
    });

    it("renders", () => {
        new Vue({
            template: `<test-component>
                            <div slot='item' slot-scope='_'>Template</div>
                        </test-component>`,
            components: {
                TestComponent
            }
        }).$mount();
        const renderedTemplate = renderItemTemplate();

        expect(renderedTemplate.nodeName).toBe("DIV");
        expect(renderedTemplate.className).toBe(DX_TEMPLATE_WRAPPER);
        expect(renderedTemplate.innerHTML).toBe("Template");
    });

    it("renders scoped slot", () => {
        new Vue({
            template: `<test-component>
                            <div slot='item' slot-scope='props'>Template {{props.text}}</div>
                        </test-component>`,
            components: {
                TestComponent
            }
        }).$mount();
        const renderedTemplate = renderItemTemplate({ text: "with data" });
        expect(renderedTemplate.innerHTML).toBe("Template with data");
    });

    it("adds templates as children", () => {
        const vm = new Vue({
            template: `<test-component ref="component">
                            <div slot='item' slot-scope='props'>Template</div>
                        </test-component>`,
            components: {
                TestComponent
            }
        }).$mount();
        renderItemTemplate({});

        const component: any = vm.$refs.component;
        expect(component.$children.length).toBe(1);
    });

    it("updates templates on component updating (check via functional component inside)", () => {
        expect.assertions(2);
        const FunctionalComponent = Vue.extend({
            functional: true,
            render(h) {
                expect(true).toBeTruthy();
                return h("div");
            }
        });
        const vm = new Vue({
            template: `<test-component ref="component">
                            <div slot='item' slot-scope='props'><functional-component/></div>
                        </test-component>`,
            components: {
                TestComponent,
                FunctionalComponent
            }
        }).$mount();
        renderItemTemplate({});

        const component: any = vm.$refs.component;
        component.$forceUpdate();
    });

    it("unwraps container", () => {
        new Vue({
            template: `<test-component>
                            <div slot='item' slot-scope='props'>Template {{props.text}}</div>
                        </test-component>`,
            components: {
                TestComponent
            }
        }).$mount();
        const renderedTemplate = renderItemTemplate(
            { text: "with data" },
            { get: () => document.createElement("div") }
        );

        expect(renderedTemplate.nodeName).toBe("DIV");
        expect(renderedTemplate.innerHTML).toBe("Template with data");
    });

    it("preserves classes", () => {
        new Vue({
            template: `<test-component>
                            <div slot='item' slot-scope='props' class='custom-class'></div>
                        </test-component>`,
            components: {
                TestComponent
            }
        }).$mount();
        const renderedTemplate = renderItemTemplate({});

        expect(renderedTemplate.className).toBe(`custom-class ${DX_TEMPLATE_WRAPPER}`);
    });

    it("preserves custom-attrs", () => {
        new Vue({
            template: `<test-component>
                            <div slot='item' slot-scope='props' custom-attr=123 ></div>
                        </test-component>`,
            components: {
                TestComponent
            }
        }).$mount();
        const renderedTemplate = renderItemTemplate({});

        expect(renderedTemplate.attributes).toHaveProperty("custom-attr");
        expect(renderedTemplate.attributes["custom-attr"].value).toBe("123");
    });

    it("doesn't throw on dxremove", () => {
        new Vue({
            template: `<test-component>
                            <div slot='item' slot-scope='props'>Template {{props.text}}</div>
                        </test-component>`,
            components: {
                TestComponent
            }
        }).$mount();

        const renderedTemplate = renderItemTemplate({ text: "with data" });

        expect(() => events.triggerHandler(renderedTemplate, "dxremove")).not.toThrow();
    });
});

describe("static items", () => {
    it("passes integrationOptions to widget", () => {
        const NestedItem = Vue.extend({
            extends: DxConfiguration,
            props: {
                prop1: Number,
                template: String
            }
        });
        (NestedItem as any as IConfigurationComponent).$_optionName = "items";
        (NestedItem as any as IConfigurationComponent).$_isCollectionItem = true;

        new Vue({
            template: `<test-component>
                         <nested-item>
                            <div slot-scope="_">1</div>
                         </nested-item>
                       </test-component>`,
            components: {
                TestComponent,
                NestedItem
            }
        }).$mount();
        const integrationOptions = WidgetClass.mock.calls[0][1].integrationOptions;

        expect(integrationOptions).toBeDefined();
        expect(integrationOptions.templates).toBeDefined();

        expect(integrationOptions.templates["items[0].template"]).toBeDefined();
        expect(typeof integrationOptions.templates["items[0].template"].render).toBe("function");
    });

    it("doesn't pass integrationOptions to widget if template prop is absent", () => {
        const NestedItem = Vue.extend({
            extends: DxConfiguration,
            props: {
                prop1: Number
            }
        });
        (NestedItem as any as IConfigurationComponent).$_optionName = "items";
        (NestedItem as any as IConfigurationComponent).$_isCollectionItem = true;

        new Vue({
            template: `<test-component>
                         <nested-item>
                            <div slot-scope="_">1</div>
                         </nested-item>
                       </test-component>`,
            components: {
                TestComponent,
                NestedItem
            }
        }).$mount();
        const integrationOptions = WidgetClass.mock.calls[0][1].integrationOptions;

        expect(integrationOptions).toBeDefined();
        expect(integrationOptions.templates).toBeUndefined();
    });

    it("renders", () => {
        const NestedItem = Vue.extend({
            extends: DxConfiguration,
            props: {
                prop1: Number,
                template: String
            }
        });
        (NestedItem as any as IConfigurationComponent).$_optionName = "items";
        (NestedItem as any as IConfigurationComponent).$_isCollectionItem = true;

        new Vue({
            template: `<test-component>
                         <nested-item>
                            <div slot-scope="_">1</div>
                         </nested-item>
                       </test-component>`,
            components: {
                TestComponent,
                NestedItem
            }
        }).$mount();

        const renderedTemplate = renderTemplate("items[0].template");

        expect(renderedTemplate.innerHTML).toBe("1");
    });
});

describe("events emitting", () => {

    it("forwards DevExtreme events in camelCase", () => {
        const expectedArgs = {};
        const parent = new Vue({
            template: "<TestComponent v-on:testEventName=''></TestComponent>",
            components: { TestComponent }
        }).$mount();
        const $emitSpy = jest.spyOn(parent.$children[0], "$emit");

        Widget.fire("testEventName", expectedArgs);

        expect($emitSpy).toHaveBeenCalledTimes(1);
        expect($emitSpy.mock.calls[0][0]).toBe("testEventName");
        expect($emitSpy.mock.calls[0][1]).toBe(expectedArgs);
    });

    it("forwards DevExtreme events in kebab-case", () => {
        const expectedArgs = {};
        const parent = new Vue({
            template: "<TestComponent v-on:test-event-name=''></TestComponent>",
            components: { TestComponent }
        }).$mount();
        const $emitSpy = jest.spyOn(parent.$children[0], "$emit");

        Widget.fire("testEventName", expectedArgs);

        expect($emitSpy).toHaveBeenCalledTimes(1);
        expect($emitSpy.mock.calls[0][0]).toBe("test-event-name");
        expect($emitSpy.mock.calls[0][1]).toBe(expectedArgs);
    });
});

describe("extension component", () => {
    const ExtensionWidgetClass = jest.fn(createWidget);
    const TestExtensionComponent = Vue.extend({
        extends: DxExtensionComponent,
        beforeCreate() {
            (this as any as IWidgetComponent).$_WidgetClass = ExtensionWidgetClass;
        }
    });

    it("renders once if mounted manually and targets self element", () => {
        const component = new TestExtensionComponent().$mount();

        const expectedElement = component.$el;
        const actualElement = ExtensionWidgetClass.mock.calls[0][0];

        expect(ExtensionWidgetClass).toHaveBeenCalledTimes(1);
        expect(actualElement).toBe(expectedElement);
    });

    it("renders once without parent element and targets self element", () => {
        const vue = new Vue({
            template: `<test-extension-component/>`,
            components: {
                TestExtensionComponent
            }
        }).$mount();

        const expectedElement = vue.$el;
        const actualElement = ExtensionWidgetClass.mock.calls[0][0];

        expect(ExtensionWidgetClass).toHaveBeenCalledTimes(1);
        expect(actualElement).toBe(expectedElement);
    });

    it("renders once inside component and targets parent element", () => {
        new Vue({
            template: `<test-component>
                            <test-extension-component/>
                        </test-component>`,
            components: {
                TestComponent,
                TestExtensionComponent
            }
        }).$mount();

        const expectedElement = WidgetClass.mock.calls[0][0];
        const actualElement = ExtensionWidgetClass.mock.calls[0][0];

        expect(ExtensionWidgetClass).toHaveBeenCalledTimes(1);
        expect(actualElement).toBe(expectedElement);
    });

    it("destroys correctly", () => {
        const component = new TestExtensionComponent().$mount();

        expect(component.$destroy.bind(component)).not.toThrow();
    });
});

describe("disposing", () => {

    it("call dispose", () => {
        const component = new TestComponent().$mount();

        component.$destroy();

        expect(Widget.dispose).toBeCalled();
    });

    it("fires dxremove", () => {
        const handleDxRemove = jest.fn();
        const component = new TestComponent().$mount();

        events.on(component.$el, "dxremove", handleDxRemove);
        component.$destroy();

        expect(handleDxRemove).toHaveBeenCalledTimes(1);
    });

    it("destroys correctly", () => {
        const component = new TestComponent();

        expect(component.$destroy.bind(component)).not.toThrow();
    });
});
