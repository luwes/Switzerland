import { takePrevProps, errorHandlers, sendEvent } from './middleware';

export { h } from 'ultradom';
export { path } from './middleware';

/**
 * @constant member ∷ Symbol
 * @type {Symbol}
 */
export const member = Symbol('Switzerland');

/**
 * @method message ∷ String → String → void
 * @param {String} message
 * @param {String} type
 * @return {void}
 *
 * Takes a message and an optional console type for output. During minification this function will be removed
 * from the generated output if 'NODE_ENV' is defined as 'production', as it will be unused due to 'process.env'
 * checks later on in the code.
 */
function message(message, type = 'error') {
    console[type](`\uD83C\uDDE8\uD83C\uDDED Switzerland: ${message}.`);
}

/**
 * @constant eventName ∷ String
 * @type {String}
 */
export const eventName = 'switzerland/resolved';

/**
 * @constant namespace ∷ String|void
 * @type {String|undefined}
 */
const namespace = self.document && document.currentScript && document.currentScript.dataset.namespace;

/**
 * @constant separator ∷ String
 * @type {String}
 */
const separator = '_';

/**
 * @method translate ∷ String → String
 * @param {String} name
 * @return {String}
 */
export const translate = name => {

    try {
        const tag = name.toLowerCase().match(/_(.+-.+)/i)[1];
        return namespace ? `${namespace}${separator}${tag}` : tag;
    } catch (err) {
        return name;
    }

};

/**
 * @class CancelError ∷ CancelError
 * @extends {Error}
 */
class CancelError extends Error {}

/**
 * @method create ∷ Props p ⇒ String → [(p → p)] → void
 * @param {String} description
 * @param {Array<Function>} middlewares
 * @return {void}
 *
 * Takes a valid name for the custom element, as well as a list of the middleware. In the future when browsers
 * support extended native elements, the 'name' argument will allowed to be passed in a slightly different format
 * to indicate its intention to extend a native element.
 *
 * This function yields a promise that is resolved when the first instance of the node has been resolved, which
 * includes the processing of its associated middleware.
 */
export function create(description, ...middlewares) {

    const [name, inheritFrom] = description.split('/');

    // When the user is extended a native element, we need to figure out which prototype to inherit from, such as
    // extended from a <button /> element will inherit from `HTMLButtonElement`, rather than the base `HTMLElement`, which
    // will allow <button /> to inherit some button-specific behaviours.
    const extendPrototype = inheritFrom ? document.createElement(inheritFrom).constructor : HTMLElement;

    customElements.define(namespace ? `${namespace}${separator}${name}` : name, class extends extendPrototype {

        /**
         * @property ∷ Symbol
         * @type {Symbol}
         */
        [member] = {
            queue: new Set(),
            boundary: null,
            actions: {
                render: this.render.bind(this),
                dispatch: (name, data) => sendEvent(name, { node: this, data, version: 1 }),
                cancel: () => { throw new CancelError(); }
            }
        };

        /**
         * @method connectedCallback ∷ Promise void
         * @return {Promise}
         */
        connectedCallback() {
            return this.render();
        }

        /**
         * @method disconnectedCallback ∷ Promise void
         * @return {Promise}
         */
        disconnectedCallback() {
            this.classList.remove('resolved');
            return this.render();
        }

        /**
         * @method render ∷ ∀ a. Object String a → Promise void
         * @param {Object} [mergeProps = {}]
         * @return {Promise}
         */
        render(mergeProps = {}) {

            const scheduledTask = new Promise(async resolve => {

                // Await the completion of the task last added to the stack.
                const tasks = Array.from(this[member].queue);
                const prevScheduledTask = tasks[tasks.length - 1];
                await prevScheduledTask;

                // Setup the props for the `props`, and setup the async `isResolved` function.
                const prevProps = takePrevProps(this);
                const isResolved = async () => {
                    const resolution = await Promise.race([scheduledTask, Promise.resolve(false)]);
                    return resolution !== false;
                };

                /**
                 * @constant Props p ⇒ props ∷ p
                 * @type {Object}
                 */
                const props = {
                    ...prevProps,
                    ...mergeProps,
                    prevProps,
                    state: { ...(prevProps || {}).state, ...mergeProps.state },
                    node: this,
                    boundary: this[member].boundary,
                    isResolved,
                    ...this[member].actions
                };

                if (prevScheduledTask && !this[member].queue.has(prevScheduledTask)) {

                    // If a caught error has removed it from the queue, then we don't go any further.
                    return void resolve(props);

                }

                try {

                    // Attempt to render the component, catching any errors that may be thrown in the middleware to
                    // prevent the component from being in an invalid state. Recovery should ALWAYS be possible!
                    await middlewares.reduce(async (accumP, _, index) => {
                        const middleware = middlewares[index];
                        return middleware(await accumP);
                    }, props);

                } catch (err) {

                    const isCancel = err instanceof CancelError;

                    // All non-cancel exceptions are considered a failure.
                    isCancel ? resolve(props) : do {

                        const getTree = errorHandlers.get(this);
                        const consoleError = !getTree || !this.isConnected;

                        consoleError ? (process.env.NODE_ENV !== 'production' && message(err)) : do {

                            try {

                                // Attempt to render the component using the error handling middleware.
                                getTree({ ...props, error: err });

                            } catch (err) {

                                if (process.env.NODE_ENV !== 'production') {

                                    // When the error handling middleware throws an error we'll need to halt the execution
                                    // because the error handler should be recovering, not compounding the problem.
                                    message(`Throwing an error from the recovery middleware for <${this.nodeName} /> is forbidden`);
                                    console.error(err);

                                }

                            } finally {

                                // Errors should cancel any enqueued middleware.
                                this[member].queue.clear();
                                resolve(props);

                            }

                        };

                    };

                }

                // Add the "resolved" class name regardless of how the component's rendered.
                this.isConnected && !this.classList.contains('resolved') && this.classList.add('resolved');

                // Finally dispatch the event for parent components to be able to resolve.
                sendEvent(eventName, { node: this, version: 1 });

                // Task has been completed successfully.
                this[member].queue.delete(prevScheduledTask);
                resolve(props);

            });

            // Add task to the queue.
            this[member].queue.add(scheduledTask);
            return scheduledTask;

        }

    }, { ...inheritFrom && { extends: inheritFrom } });

}
