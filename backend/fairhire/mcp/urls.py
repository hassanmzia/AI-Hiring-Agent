from django.urls import path
from . import server

urlpatterns = [
    path("mcp/", server.mcp_endpoint, name="mcp-endpoint"),
]
