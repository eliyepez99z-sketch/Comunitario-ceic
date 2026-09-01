// Configuración de la conexión a Supabase
const SUPABASE_URL = "https://fzvjhdeodahtxoolxzkx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6dmpoZGVvZGFodHhvb2x4emt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxODc5NjYsImV4cCI6MjEwMzc2Mzk2Nn0.CdAgxnvtMwsv1ryyrqpEdmS8ShqQMLALz5_ZwHsjSHc";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const selectCurso = document.getElementById('curso');
const form = document.getElementById('inscriptionForm');
const alertBox = document.getElementById('alert-box');
const btnSubmit = document.getElementById('btnSubmit');

// Funciones para controlar la ventana emergente
function mostrarModalExito() {
    document.getElementById('modal-exito').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modal-exito').style.display = 'none';
}

// 1. Obtener los cursos activos y con cupos desde Supabase
async function cargarCursos() {
    try {
        const { data, error } = await db
            .from('cursos')
            .select('id, nombre, cupos_disponibles')
            .eq('activo', true)
            .gt('cupos_disponibles', 0);

        if (error) throw error;

        selectCurso.innerHTML = '<option value="">-- Selecciona un curso --</option>';

        if (data && data.length > 0) {
            data.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = `${c.nombre} (${c.cupos_disponibles} cupos disponibles)`;
                selectCurso.appendChild(option);
            });
        } else {
            selectCurso.innerHTML = '<option value="">No hay cursos con cupos disponibles en este momento</option>';
        }
    } catch (err) {
        mostrarAlerta('Error al obtener la lista de cursos disponibles.', 'error');
        console.error(err);
    }
}

// 2. Registrar el estudiante y enviar solicitud de inscripción
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Procesando inscripción...";
    ocultarAlerta();

    const cedula = document.getElementById('cedula').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const apellido = document.getElementById('apellido').value.trim();
    const email = document.getElementById('email').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const cursoId = selectCurso.value;

    if (!cursoId) {
        mostrarAlerta('Por favor selecciona un curso válido.', 'warning');
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Enviar Solicitud de Inscripción";
        return;
    }

    try {
        // Comprobar si el estudiante ya está registrado en la BD por su cédula
        let { data: estudianteExistente, error: errConsulta } = await db
            .from('estudiantes')
            .select('id')
            .eq('documento_identidad', cedula);

        if (errConsulta) throw errConsulta;

        let estudianteId;

        if (estudianteExistente && estudianteExistente.length > 0) {
            estudianteId = estudianteExistente[0].id;
        } else {
            // Registrar nuevo estudiante
            const { data: nuevoEstudiante, error: errRegistro } = await db
                .from('estudiantes')
                .insert([{
                    documento_identidad: cedula,
                    nombre: nombre,
                    apellido: apellido,
                    email: email,
                    telefono: telefono
                }])
                .select();

            if (errRegistro) throw errRegistro;
            estudianteId = nuevoEstudiante[0].id;
        }

        // Crear la inscripción en estado 'Pendiente'
        const { error: errInscripcion } = await db
            .from('inscripciones')
            .insert([{
                estudiante_id: estudianteId,
                curso_id: cursoId,
                estado: 'Pendiente'
            }]);

        if (errInscripcion) {
            if (errInscripcion.message.includes('unique') || errInscripcion.code === '23505') {
                mostrarAlerta('Ya posees una solicitud registrada para este curso.', 'warning');
            } else {
                throw errInscripcion;
            }
        } else {
            // AQUÍ SE ABRE LA PANTALLA EMERGENTE AL FINALIZAR
            mostrarModalExito();
            form.reset();
            cargarCursos();
        }

    } catch (err) {
        mostrarAlerta('Ocurrió un error al procesar tu solicitud: ' + err.message, 'error');
        console.error(err);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Enviar Solicitud de Inscripción";
    }
});

function mostrarAlerta(mensaje, tipo) {
    alertBox.textContent = mensaje;
    alertBox.className = `alert-${tipo}`;
    alertBox.style.display = 'block';
}

function ocultarAlerta() {
    alertBox.style.display = 'none';
}

// Cargar los cursos al abrir la página
cargarCursos();