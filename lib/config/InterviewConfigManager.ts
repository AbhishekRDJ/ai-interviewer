// lib/config/InterviewConfigManager.ts
import { InterviewConfig, InterviewTemplate, InterviewQuestion } from '@/lib/types/interview';

export class InterviewConfigManager {
    private configs: Map<string, InterviewConfig> = new Map();
    private templates: Map<string, InterviewTemplate> = new Map();

    constructor() {
        this.loadDefaultConfigs();
    }

    private loadDefaultConfigs(): void {
        // Load the existing SDR screening config
        const sdrScreening: InterviewConfig = {
            id: 'sdr-screening',
            name: 'SDR Screening Interview',
            description: 'Standard screening interview for Sales Development Representative positions',
            duration: 10,
            passingScore: 7.0,
            categories: ['communication', 'sales_knowledge', 'problem_solving', 'professionalism'],
            questions: [
                {
                    id: "intro",
                    question: "Tell me about yourself and why you're interested in a sales development role.",
                    maxResponseTime: 90,
                    category: 'general',
                    followUpTriggers: {
                        "no_sales_mention": "What specifically attracts you to sales?",
                        "vague_response": "Can you be more specific about your experience?"
                    },
                    scoringWeight: 1
                },
                {
                    id: "cold_calling",
                    question: "How would you approach making a cold call to a potential prospect?",
                    maxResponseTime: 120,
                    category: 'technical',
                    requiredElements: ["research", "value proposition", "objection handling"],
                    scoringWeight: 2
                },
                {
                    id: "objection_handling",
                    question: "A prospect says 'We're not interested right now.' How do you respond?",
                    maxResponseTime: 90,
                    category: 'situational',
                    requiredElements: ["acknowledge", "probe", "provide value"],
                    scoringWeight: 2
                },
                {
                    id: "qualification",
                    question: "What questions would you ask to qualify a lead during your first conversation?",
                    maxResponseTime: 120,
                    category: 'technical',
                    requiredElements: ["budget", "authority", "need", "timing"],
                    scoringWeight: 2
                },
                {
                    id: "motivation",
                    question: "What motivates you in a sales role, and how do you handle rejection?",
                    maxResponseTime: 90,
                    category: 'behavioral',
                    scoringWeight: 1
                },
                {
                    id: "scenario",
                    question: "You have 50 leads to contact today, but only have time for 30 calls. How do you prioritize?",
                    maxResponseTime: 120,
                    category: 'situational',
                    requiredElements: ["prioritization criteria", "efficiency", "data-driven approach"],
                    scoringWeight: 2
                }
            ]
        };

        this.configs.set(sdrScreening.id, sdrScreening);
    }

    public getConfig(id: string): InterviewConfig | null {
        return this.configs.get(id) || null;
    }

    public getAllConfigs(): InterviewConfig[] {
        return Array.from(this.configs.values());
    }

    public addConfig(config: InterviewConfig): void {
        this.validateConfig(config);
        this.configs.set(config.id, config);
    }

    public updateConfig(id: string, updates: Partial<InterviewConfig>): boolean {
        const existing = this.configs.get(id);
        if (!existing) return false;

        const updated = { ...existing, ...updates, id }; // Preserve ID
        this.validateConfig(updated);
        this.configs.set(id, updated);
        return true;
    }

    public deleteConfig(id: string): boolean {
        return this.configs.delete(id);
    }

    public createConfigFromTemplate(templateId: string, customizations?: Partial<InterviewConfig>): InterviewConfig | null {
        const template = this.templates.get(templateId);
        if (!template) return null;

        const config: InterviewConfig = {
            id: `${templateId}-${Date.now()}`,
            name: template.name,
            description: template.description,
            duration: template.estimatedDuration,
            questions: template.questions,
            categories: this.extractCategories(template.questions),
            ...customizations
        };

        this.addConfig(config);
        return config;
    }

    public addTemplate(template: InterviewTemplate): void {
        this.validateTemplate(template);
        this.templates.set(template.id, template);
    }

    public getTemplate(id: string): InterviewTemplate | null {
        return this.templates.get(id) || null;
    }

    public getAllTemplates(): InterviewTemplate[] {
        return Array.from(this.templates.values());
    }

    public getTemplatesByCategory(category: string): InterviewTemplate[] {
        return this.getAllTemplates().filter(t => t.category === category);
    }

    public getTemplatesByDifficulty(difficulty: InterviewTemplate['difficulty']): InterviewTemplate[] {
        return this.getAllTemplates().filter(t => t.difficulty === difficulty);
    }

    public searchTemplates(query: string): InterviewTemplate[] {
        const lowerQuery = query.toLowerCase();
        return this.getAllTemplates().filter(template =>
            template.name.toLowerCase().includes(lowerQuery) ||
            template.description.toLowerCase().includes(lowerQuery) ||
            template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    public duplicateConfig(id: string, newName?: string): InterviewConfig | null {
        const original = this.configs.get(id);
        if (!original) return null;

        const duplicate: InterviewConfig = {
            ...original,
            id: `${id}-copy-${Date.now()}`,
            name: newName || `${original.name} (Copy)`
        };

        this.addConfig(duplicate);
        return duplicate;
    }

    public validateConfig(config: InterviewConfig): void {
        if (!config.id || !config.name) {
            throw new Error('Config must have id and name');
        }

        if (!config.questions || config.questions.length === 0) {
            throw new Error('Config must have at least one question');
        }

        if (config.duration <= 0) {
            throw new Error('Duration must be positive');
        }

        // Validate questions
        config.questions.forEach((question, index) => {
            if (!question.id || !question.question) {
                throw new Error(`Question ${index} must have id and question text`);
            }
            if (question.maxResponseTime <= 0) {
                throw new Error(`Question ${index} must have positive maxResponseTime`);
            }
        });

        // Check for duplicate question IDs
        const questionIds = config.questions.map(q => q.id);
        const uniqueIds = new Set(questionIds);
        if (questionIds.length !== uniqueIds.size) {
            throw new Error('Question IDs must be unique within a config');
        }
    }

    private validateTemplate(template: InterviewTemplate): void {
        if (!template.id || !template.name) {
            throw new Error('Template must have id and name');
        }

        if (!template.questions || template.questions.length === 0) {
            throw new Error('Template must have at least one question');
        }

        if (template.estimatedDuration <= 0) {
            throw new Error('Estimated duration must be positive');
        }
    }

    private extractCategories(questions: InterviewQuestion[]): string[] {
        const categories = new Set<string>();
        questions.forEach(q => {
            if (q.category) categories.add(q.category);
        });
        return Array.from(categories);
    }

    public exportConfig(id: string): string | null {
        const config = this.configs.get(id);
        if (!config) return null;
        return JSON.stringify(config, null, 2);
    }

    public importConfig(configJson: string): InterviewConfig {
        const config = JSON.parse(configJson) as InterviewConfig;
        this.validateConfig(config);
        this.addConfig(config);
        return config;
    }

    public getConfigStats(id: string): {
        totalQuestions: number;
        estimatedDuration: number;
        categoryCounts: Record<string, number>;
        averageResponseTime: number;
    } | null {
        const config = this.configs.get(id);
        if (!config) return null;

        const categoryCounts: Record<string, number> = {};
        let totalResponseTime = 0;

        config.questions.forEach(q => {
            if (q.category) {
                categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
            }
            totalResponseTime += q.maxResponseTime;
        });

        return {
            totalQuestions: config.questions.length,
            estimatedDuration: config.duration,
            categoryCounts,
            averageResponseTime: totalResponseTime / config.questions.length
        };
    }
}

// Singleton instance
export const interviewConfigManager = new InterviewConfigManager();
