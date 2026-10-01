// Memory management utilities para cober360
class MemoryManager {
    constructor() {
        this.lastGCTime = Date.now();
        this.gcInterval = 5 * 60 * 1000; // 5 minutos
        this.maxHeapUsage = 85; // Límite antes de forzar GC
        
        this.startPeriodicGC();
        console.log('🗑️ Memory Manager inicializado');
    }

    // Iniciar garbage collection periódico
    startPeriodicGC() {
        this.gcTimer = setInterval(() => {
            this.checkAndCleanMemory();
        }, this.gcInterval);
    }

    // Verificar y limpiar memoria si es necesario
    checkAndCleanMemory() {
        const memUsage = process.memoryUsage();
        const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        console.log(`🔍 Memory check - Heap: ${Math.round(heapUsagePercent)}%`);
        
        if (heapUsagePercent > this.maxHeapUsage || 
            (Date.now() - this.lastGCTime > this.gcInterval)) {
            
            this.forceGarbageCollection();
        }
    }

    // Forzar garbage collection
    forceGarbageCollection() {
        if (global.gc) {
            const beforeMem = process.memoryUsage();
            const beforePercent = (beforeMem.heapUsed / beforeMem.heapTotal) * 100;
            
            global.gc();
            
            const afterMem = process.memoryUsage();
            const afterPercent = (afterMem.heapUsed / afterMem.heapTotal) * 100;
            
            console.log(`🗑️ GC ejecutado - Heap: ${Math.round(beforePercent)}% → ${Math.round(afterPercent)}%`);
            console.log(`   Memoria liberada: ${Math.round((beforeMem.heapUsed - afterMem.heapUsed) / 1024 / 1024)}MB`);
            
            this.lastGCTime = Date.now();
        } else {
            console.log('⚠️ Garbage collection no está habilitado (usa --expose-gc)');
        }
    }

    // Limpiar referencias circulares manualmente
    clearCircularReferences() {
        // Aquí puedes agregar limpieza específica de tu aplicación
        console.log('🧹 Limpieza de referencias circulares');
    }

    // Detener el manager
    stop() {
        if (this.gcTimer) {
            clearInterval(this.gcTimer);
            this.gcTimer = null;
        }
    }

    // Obtener estadísticas de memoria
    getMemoryStats() {
        const mem = process.memoryUsage();
        return {
            rss: Math.round(mem.rss / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            external: Math.round(mem.external / 1024 / 1024),
            heapUsage: Math.round((mem.heapUsed / mem.heapTotal) * 100),
            arrayBuffers: Math.round(mem.arrayBuffers / 1024 / 1024)
        };
    }
}

module.exports = new MemoryManager();
