_listeners = {}


def subscribe(event_name, callback):
    if event_name not in _listeners:
        _listeners[event_name] = []

    _listeners[event_name].append(callback)


def emit(event_name, data=None):
    for callback in _listeners.get(event_name, []):
        callback(data)
