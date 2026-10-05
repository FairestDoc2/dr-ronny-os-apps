_cache = {}


def get(key, default=None):
    return _cache.get(key, default)


def set(key, value):
    _cache[key] = value


def clear():
    _cache.clear()
