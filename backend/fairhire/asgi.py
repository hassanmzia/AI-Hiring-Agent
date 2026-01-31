import os
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fairhire.settings")
django_asgi = get_asgi_application()

from fairhire.api.routing import websocket_urlpatterns

application = ProtocolTypeRouter(
    {
        "http": django_asgi,
        "websocket": URLRouter(websocket_urlpatterns),
    }
)
