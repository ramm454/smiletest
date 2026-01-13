"""
AI Gateway Client for Staff Service Integration
"""
import httpx
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class StaffAIClient:
    """Client for interacting with Staff AI Service"""
    
    def __init__(self, base_url: str = "http://staff-ai-service:8003"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
        )
    
    async def optimize_schedule(
        self,
        staff_data: List[Dict[str, Any]],
        shift_data: List[Dict[str, Any]],
        constraints: Optional[Dict[str, Any]] = None,
        optimization_type: str = "balanced"
    ) -> Dict[str, Any]:
        """
        Call AI service for schedule optimization
        """
        try:
            if constraints is None:
                constraints = {
                    "max_hours_per_week": 38,
                    "min_rest_between_shifts": 11,
                    "max_consecutive_days": 6,
                    "skill_match_threshold": 0.7
                }
            
            response = await self.client.post(
                f"{self.base_url}/ai/staff/optimize-schedule",
                json={
                    "staff_data": staff_data,
                    "shift_data": shift_data,
                    "constraints": constraints,
                    "optimization_type": optimization_type
                }
            )
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error(f"AI schedule optimization failed: {str(e)}")
            return self._fallback_schedule(staff_data, shift_data)
    
    async def balance_workload(
        self,
        staff_data: List[Dict[str, Any]],
        current_assignments: List[Dict[str, Any]],
        time_period: str = "weekly"
    ) -> Dict[str, Any]:
        """
        Call AI service for workload balancing
        """
        try:
            response = await self.client.post(
                f"{self.base_url}/ai/staff/balance-workload",
                json={
                    "staff_data": staff_data,
                    "current_assignments": current_assignments,
                    "time_period": time_period
                }
            )
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error(f"AI workload balancing failed: {str(e)}")
            return self._fallback_workload_balance(staff_data, current_assignments)
    
    async def predict_performance(
        self,
        staff_id: str,
        historical_data: Dict[str, Any],
        upcoming_tasks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Call AI service for performance prediction
        """
        try:
            response = await self.client.post(
                f"{self.base_url}/ai/staff/predict-performance/{staff_id}",
                json={
                    "historical_data": historical_data,
                    "upcoming_tasks": upcoming_tasks
                }
            )
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error(f"AI performance prediction failed: {str(e)}")
            return self._fallback_performance_prediction(staff_id)
    
    async def optimize_shift_swaps(
        self,
        swap_requests: List[Dict[str, Any]],
        staff_data: List[Dict[str, Any]],
        current_schedule: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Call AI service for shift swap optimization
        """
        try:
            response = await self.client.post(
                f"{self.base_url}/ai/staff/optimize-shift-swaps",
                json={
                    "swap_requests": swap_requests,
                    "staff_data": staff_data,
                    "current_schedule": current_schedule
                }
            )
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error(f"AI shift swap optimization failed: {str(e)}")
            return {"error": "AI service unavailable", "swap_requests": swap_requests}
    
    async def health_check(self) -> bool:
        """Check if AI service is healthy"""
        try:
            response = await self.client.get(f"{self.base_url}/ai/staff/health")
            return response.status_code == 200
        except:
            return False
    
    def _fallback_schedule(
        self, 
        staff_data: List[Dict[str, Any]], 
        shift_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Fallback schedule when AI service is unavailable"""
        logger.info("Using fallback scheduling algorithm")
        
        # Simple round-robin assignment
        assignments = []
        staff_index = 0
        
        for i, shift in enumerate(shift_data):
            if staff_index >= len(staff_data):
                staff_index = 0
            
            assignments.append({
                "staff_index": staff_index,
                "shift_index": i,
                "assignment_cost": 0.5,
                "suitability": 0.5,
                "fallback": True
            })
            
            staff_index += 1
        
        return {
            "optimization_id": f"fallback-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "status": "partial",
            "assignments": assignments,
            "metrics": {
                "coverage_percentage": (len(assignments) / len(shift_data)) * 100 if shift_data else 0,
                "avg_suitability_score": 50.0,
                "workload_fairness": 60.0,
                "note": "Fallback algorithm used - AI service unavailable"
            },
            "constraints_violations": [],
            "recommendations": ["AI service unavailable - using fallback scheduling"],
            "generated_at": datetime.now().isoformat()
        }
    
    def _fallback_workload_balance(
        self, 
        staff_data: List[Dict[str, Any]], 
        current_assignments: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Fallback workload balancing"""
        workload_distribution = {}
        for staff in staff_data:
            assigned_hours = sum(
                a.get('duration_hours', 0) for a in current_assignments 
                if a.get('staff_id') == staff['staff_id']
            )
            max_hours = staff.get('max_hours_per_week', 40)
            workload_distribution[staff['staff_id']] = (assigned_hours / max_hours) * 100 if max_hours > 0 else 0
        
        return {
            "balance_id": f"fallback-balance-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "staff_distribution": workload_distribution,
            "imbalance_score": 0.5,
            "redistribution_plan": [],
            "predicted_burnout_risk": {},
            "improvement_suggestions": ["AI service unavailable - monitor workload manually"],
            "fallback": True
        }
    
    def _fallback_performance_prediction(self, staff_id: str) -> Dict[str, Any]:
        """Fallback performance prediction"""
        return {
            "staff_id": staff_id,
            "predicted_performance": {
                "next_week": 0.7,
                "next_month": 0.65,
                "trend": "stable"
            },
            "risk_assessment": {
                "burnout_risk": "medium",
                "attrition_risk": "low"
            },
            "confidence_score": 0.5,
            "recommendations": ["AI service unavailable - manual assessment recommended"],
            "fallback": True
        }
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# Singleton instance
staff_ai_client = StaffAIClient()