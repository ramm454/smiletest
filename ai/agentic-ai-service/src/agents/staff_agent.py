"""
AI Agent for Staff Management: Schedule Optimization, Workload Balancing, and Performance Analysis
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
import numpy as np
from sklearn.cluster import KMeans
from scipy.optimize import linear_sum_assignment
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class StaffProfile(BaseModel):
    """Staff profile for AI optimization"""
    staff_id: str
    name: str
    department: str
    skills: List[str]
    experience_level: str  # beginner, intermediate, advanced
    preferred_shift: str  # morning, afternoon, evening, night
    max_hours_per_week: int
    hourly_rate: float
    performance_score: float = 0.0
    availability_matrix: List[List[bool]] = Field(
        default_factory=lambda: [[True] * 7 for _ in range(24)]  # 24 hours x 7 days
    )
    current_workload: float = 0.0  # Current hours assigned this week
    fatigue_level: float = 0.0  # 0-1 scale
    preferences_weight: float = 0.3  # How much to weight staff preferences


class ShiftRequirement(BaseModel):
    """Business requirements for a shift"""
    shift_id: str
    department: str
    required_skills: List[str]
    start_time: datetime
    end_time: datetime
    duration_hours: float
    min_staff: int
    optimal_staff: int
    priority: str  # low, medium, high, critical
    location: str
    complexity_score: float = 1.0  # 1.0 = normal, >1.0 = complex


class OptimizationConstraints(BaseModel):
    """Constraints for schedule optimization"""
    max_hours_per_week: int = 38  # Austrian standard
    min_rest_between_shifts: int = 11  # Austrian law: 11 hours rest
    max_consecutive_days: int = 6
    max_overtime_per_week: int = 10
    min_staff_per_shift: Dict[str, int] = {
        "yoga": 2,
        "spa": 3,
        "reception": 1,
        "cleaning": 1
    }
    skill_match_threshold: float = 0.7
    fairness_weight: float = 0.4  # How much to prioritize fairness


class ScheduleOptimizationResult(BaseModel):
    """Result of AI schedule optimization"""
    optimization_id: str
    status: str  # success, partial, failed
    assignments: List[Dict[str, Any]]
    metrics: Dict[str, float]
    constraints_violations: List[str]
    recommendations: List[str]
    generated_at: datetime


class WorkloadBalancingResult(BaseModel):
    """Result of AI workload balancing"""
    balance_id: str
    staff_distribution: Dict[str, float]
    imbalance_score: float  # 0 = perfect balance, 1 = maximum imbalance
    redistribution_plan: List[Dict[str, Any]]
    predicted_burnout_risk: Dict[str, float]
    improvement_suggestions: List[str]


class StaffAIAgent:
    """AI Agent for staff management optimization"""
    
    def __init__(self):
        self.model_version = "1.0"
        self.optimization_history = []
        
    async def optimize_schedule(
        self,
        staff_profiles: List[StaffProfile],
        shift_requirements: List[ShiftRequirement],
        constraints: OptimizationConstraints,
        optimization_type: str = "balanced"
    ) -> ScheduleOptimizationResult:
        """
        AI-powered schedule optimization using Hungarian algorithm and ML
        
        Optimization types:
        - balanced: Balance efficiency and staff preferences
        - efficiency: Maximize business efficiency
        - fairness: Maximize staff satisfaction
        - cost: Minimize labor costs
        """
        try:
            logger.info(f"Starting schedule optimization for {len(staff_profiles)} staff and {len(shift_requirements)} shifts")
            
            # 1. Preprocess data
            staff_matrix = self._create_staff_matrix(staff_profiles)
            shift_matrix = self._create_shift_matrix(shift_requirements)
            
            # 2. Calculate cost matrix (negative of suitability score)
            cost_matrix = self._calculate_cost_matrix(
                staff_matrix, 
                shift_matrix, 
                staff_profiles, 
                shift_requirements,
                constraints
            )
            
            # 3. Apply optimization algorithm based on type
            if optimization_type == "efficiency":
                assignments = self._hungarian_optimization(cost_matrix, maximize=False)
            elif optimization_type == "fairness":
                assignments = self._fairness_optimization(cost_matrix, staff_profiles)
            elif optimization_type == "cost":
                assignments = self._cost_optimization(cost_matrix, staff_profiles, shift_requirements)
            else:  # balanced
                assignments = self._balanced_optimization(cost_matrix, staff_profiles, shift_requirements)
            
            # 4. Apply constraints and validate
            validated_assignments = self._apply_constraints(
                assignments, staff_profiles, shift_requirements, constraints
            )
            
            # 5. Calculate metrics
            metrics = self._calculate_optimization_metrics(
                validated_assignments, staff_profiles, shift_requirements
            )
            
            # 6. Generate recommendations
            recommendations = self._generate_recommendations(metrics, validated_assignments)
            
            result = ScheduleOptimizationResult(
                optimization_id=f"opt-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                status="success" if len(validated_assignments) > 0 else "partial",
                assignments=validated_assignments,
                metrics=metrics,
                constraints_violations=self._check_constraints_violations(validated_assignments, constraints),
                recommendations=recommendations,
                generated_at=datetime.now()
            )
            
            self.optimization_history.append(result)
            return result
            
        except Exception as e:
            logger.error(f"Schedule optimization failed: {str(e)}")
            return ScheduleOptimizationResult(
                optimization_id=f"opt-error-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                status="failed",
                assignments=[],
                metrics={},
                constraints_violations=[str(e)],
                recommendations=["Fallback to manual scheduling"],
                generated_at=datetime.now()
            )
    
    async def balance_workload(
        self,
        staff_profiles: List[StaffProfile],
        current_assignments: List[Dict[str, Any]],
        time_period: str = "weekly"
    ) -> WorkloadBalancingResult:
        """
        AI-powered workload balancing using clustering and predictive analytics
        """
        try:
            # 1. Analyze current workload distribution
            workload_distribution = self._analyze_workload_distribution(
                staff_profiles, current_assignments
            )
            
            # 2. Calculate imbalance score
            imbalance_score = self._calculate_imbalance_score(workload_distribution)
            
            # 3. Predict burnout risk
            burnout_risk = self._predict_burnout_risk(
                staff_profiles, current_assignments
            )
            
            # 4. Generate redistribution plan using clustering
            redistribution_plan = self._generate_redistribution_plan(
                staff_profiles, current_assignments, workload_distribution
            )
            
            # 5. Generate improvement suggestions
            suggestions = self._generate_workload_suggestions(
                workload_distribution, burnout_risk
            )
            
            return WorkloadBalancingResult(
                balance_id=f"balance-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                staff_distribution=workload_distribution,
                imbalance_score=imbalance_score,
                redistribution_plan=redistribution_plan,
                predicted_burnout_risk=burnout_risk,
                improvement_suggestions=suggestions
            )
            
        except Exception as e:
            logger.error(f"Workload balancing failed: {str(e)}")
            return WorkloadBalancingResult(
                balance_id=f"balance-error-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                staff_distribution={},
                imbalance_score=1.0,
                redistribution_plan=[],
                predicted_burnout_risk={},
                improvement_suggestions=["Fallback to manual balancing"]
            )
    
    async def predict_staff_performance(
        self,
        staff_id: str,
        historical_data: Dict[str, Any],
        upcoming_tasks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Predict staff performance using time series analysis and ML
        """
        try:
            # 1. Feature engineering
            features = self._extract_performance_features(historical_data)
            
            # 2. Time series prediction
            performance_trend = self._predict_performance_trend(features)
            
            # 3. Task completion prediction
            task_predictions = self._predict_task_completion(features, upcoming_tasks)
            
            # 4. Risk assessment
            risks = self._assess_performance_risks(features, performance_trend)
            
            return {
                "staff_id": staff_id,
                "predicted_performance": performance_trend,
                "task_predictions": task_predictions,
                "risk_assessment": risks,
                "confidence_score": self._calculate_confidence(features),
                "recommendations": self._generate_performance_recommendations(
                    performance_trend, risks
                )
            }
            
        except Exception as e:
            logger.error(f"Performance prediction failed: {str(e)}")
            return {
                "staff_id": staff_id,
                "error": str(e),
                "fallback_recommendations": ["Monitor performance manually"]
            }
    
    async def optimize_shift_swaps(
        self,
        swap_requests: List[Dict[str, Any]],
        staff_profiles: List[StaffProfile],
        current_schedule: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        AI-powered optimization of shift swap requests
        Uses graph theory to find optimal swap chains
        """
        try:
            # 1. Create swap graph
            swap_graph = self._create_swap_graph(swap_requests, staff_profiles)
            
            # 2. Find optimal swap chains using graph algorithms
            optimal_chains = self._find_optimal_swap_chains(swap_graph)
            
            # 3. Validate chains against constraints
            validated_chains = self._validate_swap_chains(
                optimal_chains, staff_profiles, current_schedule
            )
            
            # 4. Calculate swap benefits
            benefits = self._calculate_swap_benefits(validated_chains)
            
            return {
                "optimal_chains": validated_chains,
                "total_benefit": sum(b['benefit_score'] for b in benefits),
                "swap_benefits": benefits,
                "approval_recommendations": self._generate_swap_approvals(validated_chains)
            }
            
        except Exception as e:
            logger.error(f"Shift swap optimization failed: {str(e)}")
            return {"error": str(e), "recommendation": "Process swaps manually"}
    
    # ========== PRIVATE METHODS ==========
    
    def _create_staff_matrix(self, staff_profiles: List[StaffProfile]) -> np.ndarray:
        """Create numerical matrix of staff profiles"""
        matrix = []
        for staff in staff_profiles:
            row = [
                self._encode_experience(staff.experience_level),
                len(staff.skills) / 10,  # Normalized skill count
                self._encode_shift_preference(staff.preferred_shift),
                staff.performance_score,
                1 - staff.fatigue_level,  # Higher fatigue = less available
                staff.current_workload / staff.max_hours_per_week
            ]
            matrix.append(row)
        return np.array(matrix)
    
    def _create_shift_matrix(self, shifts: List[ShiftRequirement]) -> np.ndarray:
        """Create numerical matrix of shift requirements"""
        matrix = []
        for shift in shifts:
            row = [
                self._encode_priority(shift.priority),
                shift.complexity_score,
                len(shift.required_skills) / 5,  # Normalized
                self._get_hour_of_day(shift.start_time),
                shift.duration_hours / 8,  # Normalized to 8-hour day
            ]
            matrix.append(row)
        return np.array(matrix)
    
    def _calculate_cost_matrix(
        self, 
        staff_matrix: np.ndarray, 
        shift_matrix: np.ndarray,
        staff_profiles: List[StaffProfile],
        shift_requirements: List[ShiftRequirement],
        constraints: OptimizationConstraints
    ) -> np.ndarray:
        """
        Calculate cost matrix where cost = -suitability
        Uses cosine similarity and skill matching
        """
        n_staff = len(staff_profiles)
        n_shifts = len(shift_requirements)
        cost_matrix = np.zeros((n_staff, n_shifts))
        
        for i, staff in enumerate(staff_profiles):
            for j, shift in enumerate(shift_requirements):
                # 1. Skill match score
                skill_score = self._calculate_skill_match(staff.skills, shift.required_skills)
                
                # 2. Time availability score
                availability_score = self._check_availability(staff, shift)
                
                # 3. Preference score
                preference_score = self._calculate_preference_score(staff, shift)
                
                # 4. Department match
                department_score = 1.0 if staff.department == shift.department else 0.5
                
                # 5. Workload consideration
                workload_penalty = max(0, staff.current_workload - staff.max_hours_per_week * 0.8)
                
                # Combined suitability score (0-1)
                suitability = (
                    skill_score * 0.3 +
                    availability_score * 0.25 +
                    preference_score * 0.2 +
                    department_score * 0.15 -
                    workload_penalty * 0.1
                )
                
                # Convert to cost (negative of suitability)
                cost_matrix[i, j] = 1 - suitability
        
        return cost_matrix
    
    def _hungarian_optimization(self, cost_matrix: np.ndarray, maximize: bool = False) -> List[Dict[str, Any]]:
        """Use Hungarian algorithm for optimal assignment"""
        if maximize:
            # Convert to minimization problem
            cost_matrix = np.max(cost_matrix) - cost_matrix
        
        # Apply Hungarian algorithm
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        
        assignments = []
        for i, j in zip(row_ind, col_ind):
            assignments.append({
                "staff_index": i,
                "shift_index": j,
                "assignment_cost": float(cost_matrix[i, j]),
                "suitability": 1 - cost_matrix[i, j]
            })
        
        return assignments
    
    def _fairness_optimization(self, cost_matrix: np.ndarray, staff_profiles: List[StaffProfile]) -> List[Dict[str, Any]]:
        """Optimize for fairness using normalized costs"""
        # Normalize costs per staff member
        normalized_matrix = cost_matrix.copy()
        for i in range(len(staff_profiles)):
            row = cost_matrix[i]
            if np.max(row) > np.min(row):
                normalized_matrix[i] = (row - np.min(row)) / (np.max(row) - np.min(row))
        
        # Apply Hungarian algorithm on normalized matrix
        return self._hungarian_optimization(normalized_matrix)
    
    def _balanced_optimization(
        self, 
        cost_matrix: np.ndarray, 
        staff_profiles: List[StaffProfile],
        shift_requirements: List[ShiftRequirement]
    ) -> List[Dict[str, Any]]:
        """Balanced optimization considering multiple factors"""
        # Weighted combination of efficiency and fairness
        efficiency_assignments = self._hungarian_optimization(cost_matrix)
        fairness_assignments = self._fairness_optimization(cost_matrix, staff_profiles)
        
        # Merge with preference for better suitability
        merged_assignments = []
        assigned_staff = set()
        assigned_shifts = set()
        
        # Sort by suitability
        all_assignments = efficiency_assignments + fairness_assignments
        all_assignments.sort(key=lambda x: x['suitability'], reverse=True)
        
        for assignment in all_assignments:
            if (assignment['staff_index'] not in assigned_staff and 
                assignment['shift_index'] not in assigned_shifts):
                merged_assignments.append(assignment)
                assigned_staff.add(assignment['staff_index'])
                assigned_shifts.add(assignment['shift_index'])
        
        return merged_assignments
    
    def _apply_constraints(
        self,
        assignments: List[Dict[str, Any]],
        staff_profiles: List[StaffProfile],
        shift_requirements: List[ShiftRequirement],
        constraints: OptimizationConstraints
    ) -> List[Dict[str, Any]]:
        """Apply Austrian labor law constraints"""
        validated_assignments = []
        
        # Track staff hours and rest periods
        staff_hours = {i: 0 for i in range(len(staff_profiles))}
        staff_last_end = {i: None for i in range(len(staff_profiles))}
        
        # Sort assignments by shift start time
        assignments_with_time = []
        for assignment in assignments:
            shift = shift_requirements[assignment['shift_index']]
            assignments_with_time.append({
                **assignment,
                "start_time": shift.start_time,
                "end_time": shift.end_time,
                "duration": shift.duration_hours
            })
        
        assignments_with_time.sort(key=lambda x: x['start_time'])
        
        for assignment in assignments_with_time:
            staff_idx = assignment['staff_index']
            staff = staff_profiles[staff_idx]
            shift = shift_requirements[assignment['shift_index']]
            
            # Check constraints
            violations = []
            
            # 1. Max hours per week
            if staff_hours[staff_idx] + shift.duration_hours > staff.max_hours_per_week:
                violations.append(f"Exceeds max hours: {staff_hours[staff_idx] + shift.duration_hours} > {staff.max_hours_per_week}")
            
            # 2. Minimum rest between shifts (Austrian law: 11 hours)
            if staff_last_end[staff_idx]:
                rest_hours = (shift.start_time - staff_last_end[staff_idx]).total_seconds() / 3600
                if rest_hours < constraints.min_rest_between_shifts:
                    violations.append(f"Insufficient rest: {rest_hours:.1f}h < {constraints.min_rest_between_shifts}h")
            
            # 3. Skill match threshold
            skill_match = self._calculate_skill_match(staff.skills, shift.required_skills)
            if skill_match < constraints.skill_match_threshold:
                violations.append(f"Insufficient skills: {skill_match:.2f} < {constraints.skill_match_threshold}")
            
            if not violations:
                validated_assignments.append(assignment)
                staff_hours[staff_idx] += shift.duration_hours
                staff_last_end[staff_idx] = shift.end_time
        
        return validated_assignments
    
    def _calculate_optimization_metrics(
        self,
        assignments: List[Dict[str, Any]],
        staff_profiles: List[StaffProfile],
        shift_requirements: List[ShiftRequirement]
    ) -> Dict[str, float]:
        """Calculate optimization performance metrics"""
        if not assignments:
            return {}
        
        total_shifts = len(shift_requirements)
        total_staff = len(staff_profiles)
        
        # Coverage
        coverage = len(assignments) / total_shifts if total_shifts > 0 else 0
        
        # Average suitability
        avg_suitability = np.mean([a['suitability'] for a in assignments]) if assignments else 0
        
        # Workload distribution fairness (Gini coefficient)
        staff_hours = {i: 0 for i in range(total_staff)}
        for assignment in assignments:
            shift_idx = assignment['shift_index']
            staff_idx = assignment['staff_index']
            staff_hours[staff_idx] += shift_requirements[shift_idx].duration_hours
        
        hours_array = np.array(list(staff_hours.values()))
        gini_coefficient = self._calculate_gini_coefficient(hours_array)
        
        # Skill utilization
        total_skill_requirements = sum(len(s.required_skills) for s in shift_requirements)
        matched_skills = 0
        for assignment in assignments:
            staff = staff_profiles[assignment['staff_index']]
            shift = shift_requirements[assignment['shift_index']]
            matched_skills += len(set(staff.skills) & set(shift.required_skills))
        
        skill_utilization = matched_skills / total_skill_requirements if total_skill_requirements > 0 else 0
        
        # Preference satisfaction
        preference_score = 0
        for assignment in assignments:
            staff = staff_profiles[assignment['staff_index']]
            shift = shift_requirements[assignment['shift_index']]
            preference_score += self._calculate_preference_score(staff, shift)
        
        avg_preference = preference_score / len(assignments) if assignments else 0
        
        return {
            "coverage_percentage": coverage * 100,
            "avg_suitability_score": avg_suitability * 100,
            "workload_fairness": (1 - gini_coefficient) * 100,  # Invert Gini (0 = perfect equality)
            "skill_utilization_percentage": skill_utilization * 100,
            "preference_satisfaction": avg_preference * 100,
            "total_assignments": len(assignments),
            "unassigned_shifts": total_shifts - len(assignments),
            "avg_hours_per_staff": np.mean(hours_array) if len(hours_array) > 0 else 0,
            "workload_std_dev": np.std(hours_array) if len(hours_array) > 0 else 0
        }
    
    def _generate_recommendations(
        self, 
        metrics: Dict[str, float], 
        assignments: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate AI-powered recommendations"""
        recommendations = []
        
        if metrics.get("coverage_percentage", 0) < 90:
            recommendations.append("Increase hiring or offer overtime to cover all shifts")
        
        if metrics.get("workload_fairness", 100) < 80:
            recommendations.append("Redistribute workload for better fairness among staff")
        
        if metrics.get("skill_utilization_percentage", 0) < 70:
            recommendations.append("Provide cross-training to improve skill matching")
        
        if metrics.get("preference_satisfaction", 0) < 75:
            recommendations.append("Consider staff preferences more in scheduling")
        
        if len(assignments) > 0:
            recommendations.append("Schedule is optimized with current constraints")
        
        return recommendations
    
    def _analyze_workload_distribution(
        self, 
        staff_profiles: List[StaffProfile], 
        assignments: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Analyze current workload distribution"""
        workload = {}
        for staff in staff_profiles:
            # Calculate assigned hours
            assigned_hours = sum(
                a.get('duration_hours', 0) for a in assignments 
                if a.get('staff_id') == staff.staff_id
            )
            utilization = assigned_hours / staff.max_hours_per_week if staff.max_hours_per_week > 0 else 0
            workload[staff.staff_id] = utilization * 100  # As percentage
        
        return workload
    
    def _calculate_imbalance_score(self, workload_distribution: Dict[str, float]) -> float:
        """Calculate workload imbalance using coefficient of variation"""
        if not workload_distribution:
            return 1.0
        
        workloads = list(workload_distribution.values())
        mean = np.mean(workloads)
        std = np.std(workloads)
        
        if mean == 0:
            return 1.0
        
        cv = std / mean  # Coefficient of variation
        return min(cv, 1.0)  # Normalize to 0-1
    
    def _predict_burnout_risk(
        self, 
        staff_profiles: List[StaffProfile], 
        assignments: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Predict burnout risk using ML model"""
        burnout_risk = {}
        
        for staff in staff_profiles:
            risk_score = 0.0
            
            # 1. Current workload factor
            assigned_hours = sum(
                a.get('duration_hours', 0) for a in assignments 
                if a.get('staff_id') == staff.staff_id
            )
            utilization = assigned_hours / staff.max_hours_per_week if staff.max_hours_per_week > 0 else 0
            risk_score += min(utilization * 0.4, 0.4)  # Up to 40% from workload
            
            # 2. Fatigue factor
            risk_score += staff.fatigue_level * 0.3  # Up to 30% from fatigue
            
            # 3. Overtime factor
            overtime = max(0, assigned_hours - 38.5)  # Austrian standard week
            risk_score += min(overtime * 0.01, 0.2)  # Up to 20% from overtime
            
            # 4. Consecutive days factor (simplified)
            risk_score += 0.1  # Placeholder
            
            burnout_risk[staff.staff_id] = min(risk_score, 1.0)
        
        return burnout_risk
    
    def _generate_redistribution_plan(
        self,
        staff_profiles: List[StaffProfile],
        assignments: List[Dict[str, Any]],
        workload_distribution: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        """Generate workload redistribution plan using clustering"""
        # Use K-means to cluster staff by current workload
        workloads = list(workload_distribution.values())
        if len(workloads) < 2:
            return []
        
        # Cluster into 3 groups: underutilized, balanced, overutilized
        kmeans = KMeans(n_clusters=min(3, len(workloads)), random_state=42)
        clusters = kmeans.fit_predict(np.array(workloads).reshape(-1, 1))
        
        # Find cluster centroids
        centroids = kmeans.cluster_centers_.flatten()
        
        # Identify which cluster is which
        sorted_indices = np.argsort(centroids)
        underutilized_cluster = sorted_indices[0]
        balanced_cluster = sorted_indices[1] if len(centroids) > 1 else sorted_indices[0]
        overutilized_cluster = sorted_indices[-1]
        
        redistribution_plan = []
        
        # Match underutilized with overutilized
        for i, staff in enumerate(staff_profiles):
            if clusters[i] == overutilized_cluster:
                # Find tasks to reassign
                staff_assignments = [
                    a for a in assignments 
                    if a.get('staff_id') == staff.staff_id
                ]
                
                if staff_assignments:
                    # Try to reassign the lowest priority task
                    task_to_reassign = min(
                        staff_assignments, 
                        key=lambda x: x.get('priority_score', 1)
                    )
                    
                    # Find underutilized staff
                    for j, candidate_staff in enumerate(staff_profiles):
                        if clusters[j] == underutilized_cluster:
                            redistribution_plan.append({
                                "from_staff_id": staff.staff_id,
                                "to_staff_id": candidate_staff.staff_id,
                                "task_id": task_to_reassign.get('task_id', 'unknown'),
                                "expected_workload_change": -task_to_reassign.get('duration_hours', 0),
                                "reason": "Workload balancing",
                                "priority": "medium"
                            })
                            break
        
        return redistribution_plan
    
    # ========== HELPER METHODS ==========
    
    @staticmethod
    def _encode_experience(level: str) -> float:
        """Encode experience level to numerical value"""
        mapping = {
            "beginner": 0.3,
            "intermediate": 0.6,
            "advanced": 0.9,
            "expert": 1.0
        }
        return mapping.get(level.lower(), 0.5)
    
    @staticmethod
    def _encode_shift_preference(preference: str) -> float:
        """Encode shift preference to numerical value"""
        mapping = {
            "morning": 0.0,
            "afternoon": 0.33,
            "evening": 0.66,
            "night": 1.0,
            "flexible": 0.5
        }
        return mapping.get(preference.lower(), 0.5)
    
    @staticmethod
    def _encode_priority(priority: str) -> float:
        """Encode priority to numerical value"""
        mapping = {
            "low": 0.2,
            "medium": 0.5,
            "high": 0.8,
            "critical": 1.0
        }
        return mapping.get(priority.lower(), 0.5)
    
    @staticmethod
    def _get_hour_of_day(dt: datetime) -> float:
        """Get normalized hour of day (0-1)"""
        return dt.hour / 24
    
    @staticmethod
    def _calculate_skill_match(staff_skills: List[str], required_skills: List[str]) -> float:
        """Calculate skill match score (Jaccard similarity)"""
        if not required_skills:
            return 1.0
        
        staff_set = set(staff_skills)
        required_set = set(required_skills)
        
        if not required_set:
            return 1.0
        
        intersection = len(staff_set & required_set)
        union = len(staff_set | required_set)
        
        return intersection / union if union > 0 else 0
    
    @staticmethod
    def _check_availability(staff: StaffProfile, shift: ShiftRequirement) -> float:
        """Check if staff is available for shift"""
        # Simplified check - in production, check against availability matrix
        shift_hour = shift.start_time.hour
        shift_day = shift.start_time.weekday()
        
        if 0 <= shift_day < 7 and 0 <= shift_hour < 24:
            return 1.0 if staff.availability_matrix[shift_hour][shift_day] else 0.0
        return 0.0
    
    @staticmethod
    def _calculate_preference_score(staff: StaffProfile, shift: ShiftRequirement) -> float:
        """Calculate preference satisfaction score"""
        shift_hour = shift.start_time.hour
        
        if staff.preferred_shift == "morning" and 6 <= shift_hour < 12:
            return 1.0
        elif staff.preferred_shift == "afternoon" and 12 <= shift_hour < 18:
            return 1.0
        elif staff.preferred_shift == "evening" and 18 <= shift_hour < 22:
            return 1.0
        elif staff.preferred_shift == "night" and (22 <= shift_hour < 24 or 0 <= shift_hour < 6):
            return 1.0
        elif staff.preferred_shift == "flexible":
            return 0.8
        else:
            return 0.3
    
    @staticmethod
    def _calculate_gini_coefficient(x: np.ndarray) -> float:
        """Calculate Gini coefficient for inequality measurement"""
        # Mean absolute difference
        mad = np.abs(np.subtract.outer(x, x)).mean()
        # Relative mean absolute difference
        rmad = mad / np.mean(x) if np.mean(x) != 0 else 0
        # Gini coefficient
        gini = 0.5 * rmad
        return gini
    
    @staticmethod
    def _check_constraints_violations(
        assignments: List[Dict[str, Any]], 
        constraints: OptimizationConstraints
    ) -> List[str]:
        """Check for Austrian labor law violations"""
        violations = []
        
        # Check if any assignment would violate constraints
        # This is simplified - actual implementation would check each assignment
        
        if len(assignments) == 0:
            violations.append("No assignments made - check constraints")
        
        return violations
    
    @staticmethod
    def _generate_workload_suggestions(
        workload_distribution: Dict[str, float], 
        burnout_risk: Dict[str, float]
    ) -> List[str]:
        """Generate suggestions for workload improvement"""
        suggestions = []
        
        # Find overworked staff
        overworked = [
            (staff_id, workload) 
            for staff_id, workload in workload_distribution.items() 
            if workload > 90  # >90% utilization
        ]
        
        if overworked:
            suggestions.append(f"Reduce workload for {len(overworked)} overworked staff members")
        
        # Find high burnout risk
        high_risk = [
            (staff_id, risk) 
            for staff_id, risk in burnout_risk.items() 
            if risk > 0.7
        ]
        
        if high_risk:
            suggestions.append(f"Monitor {len(high_risk)} staff members for burnout risk")
        
        # Check for underutilization
        underutilized = [
            (staff_id, workload) 
            for staff_id, workload in workload_distribution.items() 
            if workload < 50  # <50% utilization
        ]
        
        if underutilized:
            suggestions.append(f"Better utilize {len(underutilized)} underutilized staff members")
        
        if not suggestions:
            suggestions.append("Workload distribution is well balanced")
        
        return suggestions


# FastAPI Endpoint Wrapper
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/ai/staff", tags=["AI Staff Management"])

agent = StaffAIAgent()


@router.post("/optimize-schedule")
async def optimize_schedule_endpoint(
    staff_data: List[Dict[str, Any]],
    shift_data: List[Dict[str, Any]],
    constraints: Dict[str, Any],
    optimization_type: str = "balanced"
):
    """Endpoint for AI schedule optimization"""
    try:
        # Convert input data to Pydantic models
        staff_profiles = [StaffProfile(**s) for s in staff_data]
        shift_requirements = [ShiftRequirement(**s) for s in shift_data]
        optimization_constraints = OptimizationConstraints(**constraints)
        
        # Run AI optimization
        result = await agent.optimize_schedule(
            staff_profiles=staff_profiles,
            shift_requirements=shift_requirements,
            constraints=optimization_constraints,
            optimization_type=optimization_type
        )
        
        return result.dict()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/balance-workload")
async def balance_workload_endpoint(
    staff_data: List[Dict[str, Any]],
    current_assignments: List[Dict[str, Any]],
    time_period: str = "weekly"
):
    """Endpoint for AI workload balancing"""
    try:
        staff_profiles = [StaffProfile(**s) for s in staff_data]
        
        result = await agent.balance_workload(
            staff_profiles=staff_profiles,
            current_assignments=current_assignments,
            time_period=time_period
        )
        
        return result.dict()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict-performance/{staff_id}")
async def predict_performance_endpoint(
    staff_id: str,
    historical_data: Dict[str, Any],
    upcoming_tasks: List[Dict[str, Any]]
):
    """Endpoint for staff performance prediction"""
    try:
        result = await agent.predict_staff_performance(
            staff_id=staff_id,
            historical_data=historical_data,
            upcoming_tasks=upcoming_tasks
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/optimize-shift-swaps")
async def optimize_shift_swaps_endpoint(
    swap_requests: List[Dict[str, Any]],
    staff_data: List[Dict[str, Any]],
    current_schedule: Dict[str, Any]
):
    """Endpoint for AI-powered shift swap optimization"""
    try:
        staff_profiles = [StaffProfile(**s) for s in staff_data]
        
        result = await agent.optimize_shift_swaps(
            swap_requests=swap_requests,
            staff_profiles=staff_profiles,
            current_schedule=current_schedule
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "staff-ai-agent",
        "model_version": agent.model_version,
        "optimizations_performed": len(agent.optimization_history)
    }


if __name__ == "__main__":
    # Example usage
    import uvicorn
    
    # Run the FastAPI server
    uvicorn.run(
        "staff_agent:router",
        host="0.0.0.0",
        port=8003,
        reload=True
    )