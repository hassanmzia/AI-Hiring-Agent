from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .analytics import get_fairness_dashboard, get_agent_performance


@api_view(["GET"])
@permission_classes([AllowAny])
def fairness_dashboard(request):
    """Responsible AI fairness dashboard data."""
    job_id = request.query_params.get("job_position_id")
    return Response(get_fairness_dashboard(job_id))


@api_view(["GET"])
@permission_classes([AllowAny])
def agent_performance(request):
    """Agent performance metrics."""
    return Response(get_agent_performance())
