from django.urls import path
from . import server

urlpatterns = [
    path("a2a/agents/", server.agent_card, name="a2a-agents"),
    path("a2a/agents/<str:agent_key>/", server.agent_card, name="a2a-agent-card"),
    path("a2a/tasks/send", server.send_task, name="a2a-send-task"),
    path("a2a/tasks/send-async", server.send_task_async, name="a2a-send-task-async"),
]
