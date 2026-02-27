import { EventEmitter } from 'node:events';
class TypedEmitter extends EventEmitter {
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
}
export const bus = new TypedEmitter();
